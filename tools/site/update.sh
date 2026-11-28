#!/usr/bin/env bash
# Changes one part of the published site, kept on the `site` branch: the live game at the root and
# each preview under preview/pr-<n>/. Each change is a commit on top of the branch as it is now, so
# a live deploy and a preview never undo each other; if someone else pushed first, it starts again.
#
#   update.sh live <dist>        the live game: everything except preview/ is replaced by <dist>
#   update.sh preview <n> <dist> a pull request's preview
#   update.sh remove <n>         a closed pull request's preview is taken down
set -euo pipefail
what=$1
repo_url="${SITE_REPO_URL:-https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"
work=$(mktemp -d)
# the built game to put in, as a full path (the work below happens in another folder)
case "$what" in
  live) src=$(realpath "$2") ;;
  preview) src=$(realpath "$3") ;;
esac

for attempt in 1 2 3 4 5; do
  rm -rf "$work" && mkdir -p "$work" && cd "$work"
  git init -q
  git config user.name 'github-actions[bot]'
  git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
  if git fetch -q --depth=1 "$repo_url" site 2>/dev/null; then
    git checkout -q -B site FETCH_HEAD
  else
    git checkout -q --orphan site
  fi

  case "$what" in
    live)
      find . -mindepth 1 -maxdepth 1 ! -name .git ! -name preview -exec rm -rf {} +
      cp -R "$src"/. .
      msg="Live game from ${GITHUB_SHA}"
      ;;
    preview)
      [[ $2 =~ ^[0-9]+$ ]] || { echo "not a pull request number: $2"; exit 1; }
      if [ ! -f index.html ]; then
        echo "::error::The live game is not on the site branch yet. Run 'Deploy to GitHub Pages' once; previews are published after that."
        exit 1
      fi
      rm -rf "preview/pr-$2" && mkdir -p "preview/pr-$2"
      cp -R "$src"/. "preview/pr-$2/"
      msg="Preview of pull request #$2"
      ;;
    remove)
      [[ $2 =~ ^[0-9]+$ ]] || { echo "not a pull request number: $2"; exit 1; }
      rm -rf "preview/pr-$2"
      msg="Pull request #$2 closed: its preview is taken down"
      ;;
    *) echo "unknown: $what"; exit 1 ;;
  esac

  git add -A
  if git diff --cached --quiet; then echo "nothing changed"; exit 0; fi
  git commit -qm "$msg"
  if git push -q "$repo_url" site; then echo "pushed: $msg"; exit 0; fi
  echo "the site branch moved; trying again ($attempt)"
  sleep $((attempt * 3))
done
echo "::error::could not update the site branch"
exit 1
