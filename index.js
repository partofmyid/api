// @ts-check

import { spawn } from "child_process";
import express from "express";
import path from "path";
import fs from "fs";

const PORT = process.env.PORT || 3000;
const PASS = process.env.PASS || "password"; // only applies for git actions, to prevent spam cloning or pulling
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

app.post("/git/clone", (req, res) => {
    if (req.query.pass !== PASS) {
        res.status(401).send("Unauthorized");
        return;
    }

    const git = spawn("git", ["clone", "--depth", "1", "--branch", "main", REPO, DIR]);
    let stderr = "", stdout = "";
    git.stdout.on("data", (data) => stdout += data);
    git.stderr.on("data", (data) => stderr += data);

    git.on("exit", (code) => {
        if (code === 0) res.send(stdout);
        else res.status(500).send(stderr);
    });
});

app.post("/git/pull", (req, res) => {
    if (req.query.pass !== PASS) {
        res.status(401).send("Unauthorized");
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

app.post("/git/rm" , (req, res) => {
    if (req.query.pass !== PASS) {
        res.status(401).send("Unauthorized");
        return;
    }

    fs.rmdir(DIR, { recursive: true }, (err) => {
        if (err) res.status
        else res.send("Deleted");
    });
});

app.post("/db/sync", (req, res) => {
    if (req.query.pass !== PASS) {
        res.status(401).send("Unauthorized");
        return;
    }

    const domainsDir = path.join(DIR, "domains");
    const dbPath = path.join(process.cwd(), "db.json");
    const db = require(dbPath);

    fs.readdirSync(domainsDir).forEach((file) => {

    });
});

app.listen(PORT, () => {
    if (PASS === "password") console.log("Please change the default password");
    console.log(`Server is running on port ${PORT}`)
});