#!/usr/bin/env bash
# =============================================================================
# agents_search.sh — Parallel Claude Code workspace manager for the search repo
#
# Single-repo variant of ../agents_dotnet.sh. This script lives INSIDE the
# search repo and always operates on it: worktrees are created as siblings
# of the repo (../search-worktrees/slot-*) so they never end up inside the
# repo tree.
#
# COMMANDS
#   start [OPTIONS]      Create worktrees, launch tmux session with Claude agents
#   clean [OPTIONS]      Remove worktrees, delete branches, kill tmux session
#   restart              Restart all Claude agents in existing session panes
#   new [branch]         Add a new slot to a running session
#
# START OPTIONS
#   --no-claude          Skip launching `claude` in each pane
#   --no-install         Skip `make install` in freshly created worktrees
#   --vscode             Open VS Code for each worktree
#   --slots N            Number of slots (1-8, skips interactive prompt)
#   --help, -h           Show this help and exit
#
# START EXAMPLES
#   ./agents_search.sh start                # Interactive slot setup
#   ./agents_search.sh start --slots 3      # Launch 3 slots, no prompt
#   ./agents_search.sh start --vscode       # Also opens VS Code
#   ./agents_search.sh start --no-claude    # Panes open, claude not launched
#
# RESTART COMMAND
#   ./agents_search.sh restart              # Relaunch claude in all panes
#
# NEW COMMAND
#   ./agents_search.sh new                  # Prompted for branch name
#   ./agents_search.sh new feature/thing    # Add slot with given branch
#   Keybinding: Ctrl+b N  (set up automatically)
#
# CLEAN OPTIONS
#   --all           Remove everything without prompting
#   --help, -h      Show this help and exit
#
# WORKTREE BOOTSTRAP
#   Every new worktree gets:
#     - CLAUDE.md copied from the base repo (if not already tracked)
#     - backend/.env copied from the base repo (gitignored, needed to run anything)
#     - `make install` (backend + frontend node_modules, prisma generate)
#       unless --no-install is given
#
# SHARED INFRA — read before running several agents
#   Docker infra (`make up`: postgres :5434, rabbitmq :5672, opensearch :9200)
#   is ONE stack shared by the base repo and every worktree; ports and the
#   compose project name are fixed. Only one worktree can run `make dev` or
#   `make e2e` at a time. `make test` / `make lint` need no infra and are safe
#   to run in parallel across slots.
#
# CONFIGURATION (env vars)
#   SEARCH_REPO_DIR     Path to the search repo   (default: directory this script lives in)
#   AGENTS_OUTPUT_DIR   AI-generated output dir   (default: <repo parent>/agents)
#
# REQUIREMENTS
#   bash (to run this script), zsh (all tmux panes launch zsh, not $SHELL), tmux, git, claude
#   node + npm (for `make install`), docker (for `make up`)
#   VS Code: Shell Command 'code' in PATH  (only needed with --vscode)
#
# PANE LAYOUTS
#   1 slot  -> full screen
#   2 slots -> [ left | right ]
#   3+      -> tiled
#
# TMUX SHORTCUTS (configured by this script)
#   Ctrl+b arrow    Move between panes
#   Ctrl+b z        Zoom current pane
#   Ctrl+b d        Detach
#   Ctrl+b 1/2      Switch window (agents / base)
#   Ctrl+b N        Add a new slot (new worktree + pane + claude)
#   Ctrl+b R        Restart all claude agents
#
# MAKE COMMANDS (run inside a worktree pane)
#   make install     backend + frontend dependencies
#   make up          postgres + rabbitmq + opensearch (shared!)
#   make db-migrate  Prisma migrations
#   make db-seed     demo user
#   make os-init     products index in OpenSearch
#   make dev         API :4000 + worker + frontend :5173 (one worktree at a time)
#   make test        Vitest backend + frontend (no infra)
#   make lint        typecheck + eslint (no infra)
#   make e2e         Cypress against the running stack
#
# OUTPUT DIRS (for AI-generated artifacts, shared with the other projects)
#   agents/docs/     documentation
#   agents/plans/    feature plans
#   agents/scripts/  scripts and automation
# =============================================================================

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
PROJECT="search"
SESSION="manu1080_search_dev"
BASE_REPO="${SEARCH_REPO_DIR:-$(cd "$(dirname "$0")" && pwd)}"
PARENT_DIR="$(cd "$BASE_REPO/.." && pwd)"
WORKTREES_DIR="$PARENT_DIR/${PROJECT}-worktrees"
AGENTS_DIR="${AGENTS_OUTPUT_DIR:-$PARENT_DIR/agents}"

# All panes must open with zsh, regardless of tmux's configured default-shell
# (e.g. Homebrew bash) or $SHELL — per the "always use zsh" rule.
ZSH_BIN="$(command -v zsh || echo /bin/zsh)"
LAUNCH_CLAUDE=true
RUN_INSTALL=true
OPEN_VSCODE=false
DELETE_ALL=false
NUM_SLOTS=""
COMMAND=""

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo -e "\033[1;34m[agents]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ok]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }

# tmux refuses to attach-session when already inside a tmux client (nested
# sessions need --force). If we're already inside tmux, switch the current
# client to the target session instead of attaching a new one.
attach_or_switch() {
  local target="$1"
  if [[ -n "${TMUX:-}" ]]; then
    tmux switch-client -t "$target"
  else
    tmux attach-session -t "$target"
  fi
}

require() {
  command -v "$1" &>/dev/null || {
    echo "ERROR: '$1' is not installed or not in PATH."
    exit 1
  }
}

confirm() {
  if $DELETE_ALL; then
    echo "  $1 [y/N] y (--all)"
    return 0
  fi
  printf "  %s [y/N] " "$1"
  read -r ans </dev/tty
  [[ "$ans" =~ ^[yY]$ ]]
}

show_help() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
}

# ─── Argument parsing ─────────────────────────────────────────────────────────
if [[ $# -eq 0 ]]; then
  echo "ERROR: Command required. Use 'start', 'clean', 'restart', or 'new'."
  echo "Run with --help for usage information."
  exit 1
fi

COMMAND="$1"
shift

case "$COMMAND" in
  start|clean|restart|new) ;;
  --help|-h) show_help; exit 0 ;;
  *)
    echo "ERROR: Unknown command '$COMMAND'. Use 'start', 'clean', 'restart', or 'new'."
    exit 1
    ;;
esac

# Remaining positional args (for 'new': the branch name)
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-claude)  LAUNCH_CLAUDE=false ;;
    --no-install) RUN_INSTALL=false ;;
    --vscode)     OPEN_VSCODE=true ;;
    --all)        DELETE_ALL=true ;;
    --slots)      shift; NUM_SLOTS="$1" ;;
    --slots=*)    NUM_SLOTS="${1#--slots=}" ;;
    --help|-h)    show_help; exit 0 ;;
    -*)           echo "Unknown option: $1  (use --help for usage)"; exit 1 ;;
    *)            POSITIONAL_ARGS+=("$1") ;;
  esac
  shift
done

if [[ ! -d "$BASE_REPO/.git" ]]; then
  echo "ERROR: No git repo found at: $BASE_REPO"
  echo "Set SEARCH_REPO_DIR or run this script from inside the search repo."
  exit 1
fi

# ─── RESTART COMMAND ──────────────────────────────────────────────────────────
if [[ "$COMMAND" == "restart" ]]; then
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "ERROR: No active session '$SESSION'. Run 'start' first."
    exit 1
  fi

  log "Restarting Claude agents in '$SESSION:agents'..."
  pane_count=$(tmux list-panes -t "$SESSION:agents" 2>/dev/null | wc -l | tr -d ' ')

  for idx in $(seq 0 $(( pane_count - 1 ))); do
    tmux send-keys -t "$SESSION:agents.$idx" "q" ""
    sleep 0.3
    tmux send-keys -t "$SESSION:agents.$idx" "" ""
    sleep 0.1
    tmux send-keys -t "$SESSION:agents.$idx" "CLAUDE_CONFIG_DIR=~/.claude-personal claude" Enter
    ok "Pane $idx restarted"
  done

  ok "All $pane_count agents restarted."
  exit 0
fi

# ─── CLEAN COMMAND ────────────────────────────────────────────────────────────
if [[ "$COMMAND" == "clean" ]]; then
  ACTIVE_SESSION=$(tmux list-sessions -F '#{session_name}' 2>/dev/null \
    | grep "^${SESSION}$" | head -1 || true)

  if [[ -n "$ACTIVE_SESSION" ]]; then
    warn "tmux session '$ACTIVE_SESSION' is active."
    if confirm "Kill it?"; then
      tmux kill-session -t "$ACTIVE_SESSION"
      ok "Session '$ACTIVE_SESSION' killed."
    fi
  else
    log "No active tmux session matching '${SESSION}'."
  fi

  echo ""
  log "Scanning $WORKTREES_DIR for managed worktrees..."

  if [[ ! -d "$WORKTREES_DIR" ]]; then
    ok "Directory $WORKTREES_DIR does not exist. Nothing to clean."
    exit 0
  fi

  FOUND=0

  for wt_path in "$WORKTREES_DIR"/slot-*; do
    [[ -d "$wt_path" ]] || continue
    FOUND=1

    branch=$(
      git -C "$BASE_REPO" worktree list --porcelain \
      | grep -A5 "worktree $wt_path" \
      | grep "^branch" \
      | sed 's|branch refs/heads/||' \
      || true
    )

    echo ""
    echo "  Worktree : $wt_path"
    echo "  Branch   : ${branch:-<unknown>}"

    if [[ -d "$wt_path" ]] && ! git -C "$wt_path" diff --quiet 2>/dev/null; then
      warn "Uncommitted changes in this worktree!"
      if ! confirm "Remove anyway?"; then
        echo "  Skipping."
        continue
      fi
    else
      if ! confirm "Remove this worktree?"; then
        echo "  Skipping."
        continue
      fi
    fi

    # --force also drops the untracked node_modules / .env we bootstrapped.
    git -C "$BASE_REPO" worktree remove --force "$wt_path" 2>/dev/null \
      || rm -rf "$wt_path"
    ok "Worktree removed."

    if [[ -n "$branch" ]]; then
      if confirm "Also delete branch '$branch'?"; then
        git -C "$BASE_REPO" branch -D "$branch" && ok "Branch '$branch' deleted."
      fi
    fi
  done

  if [[ $FOUND -eq 0 ]]; then
    ok "No slot worktrees found in $WORKTREES_DIR."
  fi

  echo ""
  log "Pruning stale worktree metadata..."
  git -C "$BASE_REPO" worktree prune
  ok "Done. Remaining worktrees:"
  git -C "$BASE_REPO" worktree list
  exit 0
fi

# ─── Shared setup for start / new ─────────────────────────────────────────────
require tmux
require git
require zsh
require make
$LAUNCH_CLAUDE && require claude
$OPEN_VSCODE   && require code
$RUN_INSTALL   && require npm

# Copies the gitignored / untracked files a worktree needs to be usable and
# installs dependencies. Idempotent: safe to call on an existing worktree.
bootstrap_worktree() {
  local path="$1"

  if [[ ! -f "$path/CLAUDE.md" && -f "$BASE_REPO/CLAUDE.md" ]]; then
    cp "$BASE_REPO/CLAUDE.md" "$path/CLAUDE.md"
    ok "Copied CLAUDE.md to worktree" >&2
  fi

  if [[ ! -f "$path/backend/.env" ]]; then
    if [[ -f "$BASE_REPO/backend/.env" ]]; then
      cp "$BASE_REPO/backend/.env" "$path/backend/.env"
      ok "Copied backend/.env to worktree" >&2
    elif [[ -f "$path/backend/.env.example" ]]; then
      cp "$path/backend/.env.example" "$path/backend/.env"
      warn "No backend/.env in base repo; created one from .env.example" >&2
    fi
  fi

  if $RUN_INSTALL; then
    if [[ -d "$path/backend/node_modules" && -d "$path/frontend/node_modules" ]]; then
      ok "Dependencies already installed" >&2
    else
      log "Running 'make install' in worktree (this takes a while)..." >&2
      make -C "$path" install >&2
      ok "Dependencies installed" >&2
    fi
  fi
}

setup_worktree_path() {
  # Prints only the path to stdout; all logs go to stderr
  local branch="$1"
  local slot_dir="slot-${branch//\//-}"
  local path="$WORKTREES_DIR/$slot_dir"

  if [[ -d "$path" ]]; then
    ok "Worktree already exists: $path  ($branch)" >&2
    bootstrap_worktree "$path"
    echo "$path"
    return
  fi

  if ! git -C "$BASE_REPO" show-ref --quiet "refs/heads/$branch"; then
    local default_branch
    default_branch=$(
      git -C "$BASE_REPO" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \
      | sed 's|refs/remotes/origin/||' \
      || echo "main"
    )
    log "Creating branch '$branch' from '$default_branch'..." >&2
    git -C "$BASE_REPO" branch "$branch" "$default_branch" >&2
  fi

  log "Adding worktree -> $branch" >&2
  git -C "$BASE_REPO" worktree add "$path" "$branch" >&2

  bootstrap_worktree "$path"

  ok "Ready: $path" >&2
  echo "$path"
}

# ─── NEW COMMAND ──────────────────────────────────────────────────────────────
if [[ "$COMMAND" == "new" ]]; then
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "ERROR: No active session '$SESSION'. Run 'start' first."
    exit 1
  fi

  new_branch="${POSITIONAL_ARGS[0]:-}"
  if [[ -z "$new_branch" ]]; then
    existing=$(find "$WORKTREES_DIR" -maxdepth 1 -name 'slot-*' -type d 2>/dev/null | wc -l | tr -d ' ')
    next_slot=$(( existing + 1 ))
    printf "  Branch name for new slot [manu1080/%s-slot-%s]: " "$PROJECT" "$next_slot"
    read -r new_branch </dev/tty
    new_branch="${new_branch:-manu1080/$PROJECT-slot-$next_slot}"
  fi

  new_path=$(setup_worktree_path "$new_branch")

  tmux split-window -t "$SESSION:agents" -h -c "$new_path" "exec -l $ZSH_BIN"
  tmux select-layout -t "$SESSION:agents" tiled

  if $LAUNCH_CLAUDE; then
    pane_count=$(tmux list-panes -t "$SESSION:agents" | wc -l | tr -d ' ')
    new_idx=$(( pane_count - 1 ))
    tmux select-pane -t "$SESSION:agents.$new_idx" -T "slot-$pane_count | $new_branch"
    tmux send-keys -t "$SESSION:agents.$new_idx" "cd '$new_path' && CLAUDE_CONFIG_DIR=~/.claude-personal claude" Enter
  fi

  ok "New slot '$new_branch' added to $PROJECT."
  exit 0
fi

# ─── START COMMAND ────────────────────────────────────────────────────────────
mkdir -p "$WORKTREES_DIR"
mkdir -p "$AGENTS_DIR/docs" "$AGENTS_DIR/plans" "$AGENTS_DIR/scripts" "$AGENTS_DIR/screenshots"

log "Fetching latest changes from origin..."
git -C "$BASE_REPO" fetch origin

DEFAULT_BRANCH=$(
  git -C "$BASE_REPO" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \
  | sed 's|refs/remotes/origin/||' \
  || echo "main"
)

# Slots branch off the default branch, so make sure the local copy is current.
# We don't touch the base repo's checked-out branch: new slot branches are
# created straight from origin/<default> (see setup_worktree_path).
git -C "$BASE_REPO" fetch origin "$DEFAULT_BRANCH:$DEFAULT_BRANCH" 2>/dev/null \
  || warn "Could not fast-forward local '$DEFAULT_BRANCH' (is it checked out with local changes?). Using it as-is."
ok "Branch '$DEFAULT_BRANCH' is up to date."

# ─── How many slots? ──────────────────────────────────────────────────────────
if [[ -z "$NUM_SLOTS" ]]; then
  echo ""
  printf "  How many agents do you want for %s? [1-8]: " "$PROJECT"
  read -r NUM_SLOTS </dev/tty
fi

if ! [[ "$NUM_SLOTS" =~ ^[1-8]$ ]]; then
  echo "ERROR: Enter a number between 1 and 8."
  exit 1
fi
ok "Setting up $NUM_SLOTS slot(s) for $PROJECT."

# ─── Branch names ─────────────────────────────────────────────────────────────
echo ""
echo "  Branch name for each slot."
echo "  Leave blank to use default: manu1080/$PROJECT-slot-N"
echo ""

declare -a BRANCHES=()

for i in $(seq 1 "$NUM_SLOTS"); do
  printf "  Slot %s [manu1080/%s-slot-%s]: " "$i" "$PROJECT" "$i"
  read -r input </dev/tty
  BRANCHES[$i]="${input:-manu1080/$PROJECT-slot-$i}"
done
echo ""

# ─── Worktrees ────────────────────────────────────────────────────────────────
log "Setting up worktrees in $WORKTREES_DIR..."

declare -a PATHS=()
for i in $(seq 1 "$NUM_SLOTS"); do
  PATHS[$i]=$(setup_worktree_path "${BRANCHES[$i]}")
done

# ─── VS Code ──────────────────────────────────────────────────────────────────
if $OPEN_VSCODE; then
  log "Opening VS Code for each worktree..."
  for i in $(seq 1 "$NUM_SLOTS"); do
    code "${PATHS[$i]}"
  done
  ok "VS Code windows launched."
fi

# ─── tmux session ─────────────────────────────────────────────────────────────
if tmux has-session -t "$SESSION" 2>/dev/null; then
  warn "Session '$SESSION' already exists. Reconnecting..."
  attach_or_switch "$SESSION"
  exit 0
fi

log "Creating tmux session '$SESSION' with $NUM_SLOTS pane(s)..."

tmux new-session -d -s "$SESSION" -n "agents" -c "${PATHS[1]}" "exec -l $ZSH_BIN"

for i in $(seq 2 "$NUM_SLOTS"); do
  tmux split-window -t "$SESSION:agents" -h -c "${PATHS[$i]}" "exec -l $ZSH_BIN"
done

if [[ "$NUM_SLOTS" -eq 1 ]]; then
  : # full screen
elif [[ "$NUM_SLOTS" -eq 2 ]]; then
  tmux select-layout -t "$SESSION:agents" even-horizontal
else
  tmux select-layout -t "$SESSION:agents" tiled
fi

# Window "base" — clean shell on the base repo (use it for `make up`, which
# is shared by every worktree)
tmux new-window -t "$SESSION" -n "base" -c "$BASE_REPO" "exec -l $ZSH_BIN"

# Show pane titles in the status bar (slot + branch always visible)
tmux set-option -t "$SESSION" pane-border-status top
tmux set-option -t "$SESSION" pane-border-format " #{pane_title} "

# ─── Keybindings ──────────────────────────────────────────────────────────────
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

# Ctrl+b N -> add new slot to running session
tmux bind-key -T prefix N run-shell "bash '$SCRIPT_PATH' new"

# Ctrl+b R -> restart all agents
tmux bind-key -T prefix R run-shell "bash '$SCRIPT_PATH' restart"

# ─── Launch Claude ────────────────────────────────────────────────────────────
if $LAUNCH_CLAUDE; then
  log "Launching claude in each pane..."

  declare -a COLORS=("blue" "green" "yellow" "magenta" "cyan" "red" "white" "colour208")

  for i in $(seq 1 "$NUM_SLOTS"); do
    pane_idx=$(( i - 1 ))
    color="${COLORS[$pane_idx]:-colour208}"
    branch="${BRANCHES[$i]}"
    path="${PATHS[$i]}"

    tmux select-pane -t "$SESSION:agents.$pane_idx" -P "fg=$color"

    # Set pane title to slot/branch so it's always visible
    tmux select-pane -t "$SESSION:agents.$pane_idx" -T "slot-$i | $branch"

    # cd into the worktree first so Claude starts with the right context
    tmux send-keys -t "$SESSION:agents.$pane_idx" "cd '$path' && CLAUDE_CONFIG_DIR=~/.claude-personal claude" Enter
  done

  ok "Claude instances launched"
fi

tmux select-window -t "$SESSION:agents"
tmux select-pane -t "$SESSION:agents.0"

ok "All set. Attaching..."
echo ""
echo "  +- Tmux shortcuts -----------------------------------------------+"
echo "  |  Ctrl+b arrows  move between panes                             |"
echo "  |  Ctrl+b z       zoom current pane (toggle fullscreen)          |"
echo "  |  Ctrl+b d       detach (session stays alive in background)     |"
echo "  |  Ctrl+b 1/2     switch window (agents / base)                  |"
echo "  |  Ctrl+b N       add a new slot (worktree + pane + claude)      |"
echo "  |  Ctrl+b R       restart all claude agents                      |"
echo "  +-----------------------------------------------------------------+"
echo ""
echo "  +- Make commands --------------------------------------------------+"
echo "  |  make up          shared infra: postgres/rabbitmq/opensearch     |"
echo "  |  make dev         API :4000 + worker + web :5173 (ONE slot only)  |"
echo "  |  make test        vitest backend + frontend (no infra, parallel) |"
echo "  |  make lint        typecheck + eslint (no infra, parallel)        |"
echo "  |  make e2e         cypress against the running stack              |"
echo "  +--------------------------------------------------------------------+"
echo ""
echo "  +- Agents output ------------------------------------------------+"
echo "  |  $AGENTS_DIR"
echo "  |    docs/     generated documentation                           |"
echo "  |    plans/    feature plans                                     |"
echo "  |    scripts/  scripts and automation                            |"
echo "  +----------------------------------------------------------------+"
echo ""

attach_or_switch "$SESSION"
