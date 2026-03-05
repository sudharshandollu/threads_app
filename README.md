{
  "name": "team-copilot",
  "displayName": "Team Copilot",
  "version": "0.0.1",
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": [
    "onCommand:teamCopilot.complete",
    "onCommand:teamCopilot.chat"
  ],
  "main": "./out/extension.js",

  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },

  "contributes": {
    "commands": [
      {
        "command": "teamCopilot.complete",
        "title": "Team Copilot: Complete Code"
      },
      {
        "command": "teamCopilot.chat",
        "title": "Team Copilot: Ask About Code"
      }
    ]
  },

  "dependencies": {
    "axios": "^1.6.0"
  },

  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/vscode": "^1.85.0",
    "@types/node": "^20.0.0"
  }
}




{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": ["node_modules", ".vscode-test"]
}


