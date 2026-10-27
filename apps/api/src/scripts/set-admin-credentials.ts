import "dotenv/config";
import { createInterface } from "node:readline";
import { argon2id, hash } from "argon2";
import { getPrisma } from "../db.js";

function readSecret(prompt: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(new Error("Run this command in an interactive terminal so the password is not echoed."));
  }

  process.stdout.write(prompt);
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("Admin setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else value += character;
      }
    };
    input.on("data", onData);
  });
}

async function main() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await new Promise<string>((resolve) => prompt.question("Admin email: ", resolve)))
    .trim()
    .toLocaleLowerCase();
  prompt.close();

  const password = await readSecret("New admin password (minimum 12 characters): ");
  if (password.length < 12 || password.length > 256) {
    throw new Error("The password must be between 12 and 256 characters.");
  }
  const confirmation = await readSecret("Confirm password: ");
  if (password !== confirmation) throw new Error("The passwords do not match.");

  const passwordHash = await hash(password, { type: argon2id });
  const prisma = getPrisma();
  const existing = await prisma.admin.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    await prisma.admin.update({
      where: { id: existing.id },
      data: { passwordHash, disabled: false, authVersion: { increment: 1 } },
    });
  } else {
    const count = await prisma.admin.count();
    if (count > 0) throw new Error("Only one Wachoo admin account is allowed in this setup.");
    await prisma.admin.create({ data: { email, passwordHash } });
  }

  console.info(existing ? "Admin credentials updated." : "Admin account created.");
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Admin setup failed."}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const prisma = getPrisma();
      await prisma.$disconnect();
    } catch {
      // The database may not have been configured if setup stopped early.
    }
  });
