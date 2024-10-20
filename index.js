// @ts-check

import pocketbase from "pocketbase";
import cp from "child_process";
import express from "express";
import path from "path";
import fs from "fs";

const settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
const app = express();
const pb = new pocketbase(settings.pb);

pb.autoCancellation(false);
app.set("trust proxy", true);
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    if (req.path.startsWith("/git") || req.path.startsWith("/db")) {
        if (req.query.pass !== settings.pass) {
            res.status(401).send("Unauthorized");
            return;
        }
    }

    console.log(`[${new Date().toLocaleString()}] ${req.ip} ${req.method} ${req.path}`);
    next();    
});

app.post("/git/clone", (req, res) => {
    const git = cp.spawn("/usr/bin/env", ["git", "clone", "--depth", "1", "--branch", "main", settings.repo, settings.dir]);
    let stderr = "", stdout = "";
    git.stdout.on("data", (data) => stdout += data);
    git.stderr.on("data", (data) => stderr += data);

    git.on("exit", (code) => {
        if (code === 0) res.send(stdout);
        else res.status(500).send(stderr);
    });
});

app.post("/git/pull", (req, res) => {
    if (!fs.existsSync(settings.dir)) {
        res.status(404).send("Directory not found");
        return;
    }

    const git = cp.spawn("/usr/bin/env", ["git", "pull"], { cwd: settings.dir });
    let stderr = "", stdout = "";
    git.stdout.on("data", (data) => stdout += data);
    git.stderr.on("data", (data) => stderr += data);

    git.on("exit", (code) => {
        if (code === 0) res.send(stdout);
        else res.status(500).send(stderr);
    });
});

app.post("/git/rm" , (req, res) => {
    fs.rmdir(settings.dir, { recursive: true }, (err) => {
        if (err) res.status
        else res.send("Deleted");
    });
});

app.post("/db/sync", async (req, res) => {
    const domainsDir = path.join(settings.dir, "domains");
    const pushed = [], fails = [];

    fs.readdirSync(domainsDir).forEach(async (file) => {
        const conf = JSON.parse(fs.readFileSync(path.join(domainsDir, file), "utf8"));
        if (!conf?.record || !conf?.owner?.username) return;

        const record = {
            subdomain: file.split(".").slice(0, -1).join("."),
            username: conf.owner.username,
            records: conf.record,
            proxied: conf?.proxied || false,
        }

        let existingId = '';
        await pb.collection('subdomains').getList(1, 1, {
            filter: `subdomain = '${record.subdomain}'`,
            fields: 'id,subdomain'
        }).then((res) => {
            for (const i of res.items) {
                if (i.subdomain !== record.subdomain) continue;
                existingId = i.id;
                break;
            }
        }, (ej) => {
            // record not found, proceed           
        });

        let promise = null;

        if (existingId) promise = pb.collection('subdomains').update(existingId, record);
        else promise = pb.collection('subdomains').create(record);

        promise.then(() => pushed.push(record.subdomain), (err) => {
            fails.push(record.subdomain);
            console.error(`Failed to sync ${record.subdomain}:`);
            console.error(err);
        });
    });

    res.json({ pushed, fails });
});

app.post("/db/gc", async (req, res) => {
    const domainsDir = path.join(settings.dir, "domains");
    const deleted = [], fails = [];

    const local = fs.readdirSync(domainsDir).map((i) => i.split(".").slice(0, -1).join("."));
    const remote = (await pb.collection('subdomains').getList(1, 9999, {
        fields: 'id,subdomain',
    })).items.map((i) => ({
        id: i.id,
        subdomain: i.subdomain,
    }));
    
    for (const sub of remote) {
        if (!local.includes(sub.subdomain)) {
            await pb.collection('subdomains').delete(sub.id).then(() => {
                deleted.push(sub.subdomain);
            }, (err) => {
                fails.push(sub.subdomain);
                console.error(`Failed to delete ${sub.subdomain}:`);
                console.error(err);
            });
        }
    }

    res.json({ deleted, fails });
});

app.listen(settings.port, async () => {
    console.log(`Server is running on port ${settings.port}`)
});