---
description: Manage Claude Code plugins and marketplaces. Sub-commands: marketplace add <url>, marketplace list, marketplace remove <name>, install <plugin>[@<marketplace>], list, search <query>, remove <plugin>
---

# /plugin

Manage Claude Code plugins and plugin marketplaces stored in `~/.claude/plugins/`.

## Usage

```bash
/plugin marketplace add <github-url>   # Register a GitHub repo as a marketplace
/plugin marketplace list               # Show known marketplaces
/plugin marketplace remove <name>      # Remove a marketplace entry
/plugin install <plugin>[@<mkt>]       # Install a plugin from a marketplace
/plugin list                           # List installed plugins
/plugin search <query>                 # Search across known marketplaces
/plugin remove <name>                  # Uninstall a plugin
```

## Argument Parsing

Parse `$ARGUMENTS` by splitting on whitespace:
- First token: sub-command (`marketplace`, `install`, `list`, `search`, `remove`)
- For `marketplace`: second token is the action (`add`, `list`, `remove`), remaining tokens are args
- For others: remaining tokens are the target

## File Layout

```
~/.claude/plugins/
├── known_marketplaces.json   # Registered marketplace index
├── installed_plugins.json    # Installed plugin records
├── cache/                    # Downloaded plugin sources
└── marketplaces/             # Fetched marketplace indexes
```

## Workflow: `marketplace add <url>`

### Step 1 — Validate URL

Accept GitHub URLs in any of these forms:
- `https://github.com/<owner>/<repo>`
- `https://github.com/<owner>/<repo>.git`
- `git@github.com:<owner>/<repo>.git`

Extract `owner` and `repo`. Reject anything that is not a GitHub URL.

### Step 2 — Detect Marketplace Type

Check whether the target repo is an **ECC-style** repo or a **plugin index** repo.

```bash
PLUGINS_DIR="$HOME/.claude/plugins"
mkdir -p "$PLUGINS_DIR/cache"
```

Fetch the repo's root file listing via GitHub API (unauthenticated):
```bash
curl -sf "https://api.github.com/repos/<owner>/<repo>/contents/" | \
  jq -r '.[].name'
```

Classify as **ECC-style** if the listing contains `install.sh` or `scripts/install-apply.js`.
Classify as **plugin-index** if it contains `marketplace.json` or `plugins.json` or `index.json`.
Otherwise classify as **unknown** and warn the user.

### Step 3 — Write to known_marketplaces.json

Read `~/.claude/plugins/known_marketplaces.json` (create with `{}` if absent).

Add or update an entry keyed by `<owner>/<repo>`:

```json
{
  "<owner>/<repo>": {
    "name": "<repo>",
    "owner": "<owner>",
    "url": "<canonical-https-url>",
    "type": "ecc | plugin-index | unknown",
    "added_at": "<ISO timestamp>"
  }
}
```

Write the updated JSON back.

### Step 4 — Confirm and Offer Next Steps

Report:
```
✓ Marketplace added: <owner>/<repo> (type: <type>)

For ECC-style repos:
  Run /plugin install ecc@<owner>/<repo> to install the full collection
  Or use /auto-update to pull latest changes if ECC is already installed

For plugin-index repos:
  Run /plugin search <query> to browse available plugins
  Run /plugin install <plugin>@<owner>/<repo> to install a specific plugin
```

## Workflow: `marketplace list`

Read `~/.claude/plugins/known_marketplaces.json`.
If empty or absent: print "No marketplaces registered. Use `/plugin marketplace add <url>` to add one."
Otherwise display as a table:

```
MARKETPLACE              TYPE          ADDED
affaan-m/ECC             ecc           2026-05-31
anthropics/claude-plugins plugin-index  2026-04-01
```

## Workflow: `marketplace remove <name>`

Match `<name>` against keys in `known_marketplaces.json` (exact or suffix match on repo name).
Confirm with the user before removing. Remove the entry and any cached data under `~/.claude/plugins/cache/<name>/`.

## Workflow: `install <plugin>[@<marketplace>]`

### ECC-style install

When `<plugin>` is `ecc` or the target marketplace type is `ecc`:

1. Locate the ECC repo:
   - Check `$CLAUDE_PLUGIN_ROOT` first
   - Fall back to `~/.claude/plugins/cache/<owner>/<repo>`
   - If not cached, clone it:
     ```bash
     git clone --depth 1 <url> ~/.claude/plugins/cache/<owner>/<repo>
     ```

2. Run the ECC installer:
   ```bash
   node ~/.claude/plugins/cache/<owner>/<repo>/scripts/install-apply.js --profile full
   ```

3. Record in `installed_plugins.json`:
   ```json
   {
     "ecc@<owner>/<repo>": {
       "marketplace": "<owner>/<repo>",
       "installed_at": "<ISO timestamp>",
       "profile": "full"
     }
   }
   ```

### Plugin-index install

When `<plugin>` is `<name>@<marketplace>`:

1. Fetch the marketplace index from `~/.claude/plugins/marketplaces/<marketplace>/index.json`
   (download if not cached)
2. Locate the plugin entry and its source URL
3. Download plugin files to `~/.claude/plugins/cache/<marketplace>/<name>/`
4. Copy plugin files to their target locations under `~/.claude/`
5. Record in `installed_plugins.json`

## Workflow: `list`

Read `~/.claude/plugins/installed_plugins.json`.
Display installed plugins with name, marketplace, and install date.

## Workflow: `search <query>`

For each marketplace in `known_marketplaces.json`:
- If type `ecc`: search commands, skills, agents by name matching `<query>`
- If type `plugin-index`: search its cached index

Display matching plugins with source marketplace.

## Workflow: `remove <name>`

Locate the plugin in `installed_plugins.json`. Remove its installed files (tracked during install).
Update `installed_plugins.json`.

## Error Handling

- Network failures: report clearly, suggest `--offline` mode is not yet supported
- Missing jq: fall back to `node -e` JSON parsing
- Permission errors on `~/.claude/plugins/`: report path and suggest manual `mkdir -p`

## Related Commands

- `/auto-update` — Update an already-installed ECC collection
- `/project-init` — Initialize ECC for a specific project
- `/ecc-guide` — Browse ECC features interactively
