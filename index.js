// @ts-check

import { spawn } from "child_process";
import express from "express";
import path from "path";
import fs from "fs";

const PORT = process.env.PORT || 3000;
const PASS = process.env.PASS || "password"; // only applies for git and db actions, to prevent spam cloning or pulling
const REPO = process.env.REPO_URL || "https://github.com/partofmyid/register";
const DIR = process.env.DIR || "repo";

console.log(`\
Start settings (process.env to modify):
PORT: ${PORT}
PASS: ${PASS}
REPO: ${REPO}
DIR: ${DIR}
`);
const app = express();

app.set("trust proxy", true);
app.use(express.json());
app.use((req, res, next) => {
    if ((req.originalUrl.startsWith("/git") || req.originalUrl.startsWith("/db")) && req.query.pass !== PASS) {
        res.status(401).send("Unauthorized");
        return;
    }

    console.log(`[${new Date().toISOString()}] ${req.ip} ${req.method} ${req.originalUrl}`);
    next();
});

app.post("/git/clone", (_, res) => {
    const git = spawn("git", ["clone", "--depth", "1", "--branch", "main", REPO, DIR]);
    let stderr = "", stdout = "";
    git.stdout.on("data", (data) => stdout += data);
    git.stderr.on("data", (data) => stderr += data);

    git.on("exit", (code) => {
        if (code === 0) res.send(stdout);
        else res.status(500).send(stderr);
    });
});

app.post("/git/pull", (_, res) => {
    if (!fs.existsSync(DIR)) {
        res.status(500).send("Directory not found");
        return;
    }

    const git = spawn("git", ["pull"], { cwd: DIR });
    let stderr = "", stdout = "";
    git.stdout.on("data", (data) => stdout += data);
    git.stderr.on("data", (data) => stderr += data);

    git.on("exit", (code) => {
        if (code === 0) res.send(stdout);
        else res.status(500).send(stderr);
    });
});

app.post("/git/rm" , (_, res) => {
    fs.rmdir(DIR, { recursive: true }, (err) => {
        if (err) res.status
        else res.send("Deleted");
    });
});

app.post("/db/sync", (_, res) => {
    const domainsDir = path.join(DIR, "domains");
    const dbPath = path.join(process.cwd(), "db.json");
    const db = []

    try {
        fs.readdirSync(domainsDir).forEach((file) => db.push({
            subdomain: file.split(".").slice(0, -1).join("."), 
            properties: JSON.parse(fs.readFileSync(path.join(domainsDir, file), "utf8")) 
        }));

        fs.writeFileSync(dbPath, JSON.stringify(db));
        res.send("Database sync success");
    } catch (err) {
        res.status(500).send(err.message);
        return;
    }
});

app.get("/db/raw", (_, res) => {
    readDB()
        .then((db) => res.send(db))
        .catch((err) => res.status(500).send(err.message));
});

app.get("/query/count", (_, res) => {
    readDB()
        .then((db) => res.send({ count: db.length }))
        .catch((err) => res.status(500).send(err.message));
});

app.get("/query/check/:subdomain", (req, res) => {
    readDB().then((db) => {
        const data = db.find((entry) => entry.subdomain === req.params.subdomain);
        let available;
        if (data) available = false;
        else available = true;
        res.send({ available });
    }).catch((err) => res.status(500).send(err.message));
});

app.get("/query/subdomain/:subdomains", (req, res) => {
    readDB().then((db) => {
        const subdomains = req.params.subdomains.split(",");
        const result = subdomains.map((subdomain) => {
            const data = db.find((entry) => entry.subdomain === subdomain);
            return { subdomain, available: !data };
        });
        res.send(result);
    }).catch((err) => res.status(500).send(err.message));
});

app.get("/query/username/:username", (req, res) => {
    readDB().then((db) => {
        res.send(db.filter((entry) => entry.properties.owner.username === req.params.username));
    }).catch((err) => res.status(500).send(err.message));
});

app.listen(PORT, () => {
    if (PASS === "password") console.log("Please change the default password");
    console.log(`Server is running on port ${PORT}`)
});

function readDB() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(process.cwd(), "db.json");
        fs.readFile(dbPath, "utf8", (err, data) => {
            if (err) reject(err);
            else resolve(JSON.parse(data));
        });
    });
}