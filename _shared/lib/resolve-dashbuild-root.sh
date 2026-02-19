_DIR="$1"
while true; do
  if [ -f "${_DIR}/package.json" ] && node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.exit(p.name==='dashbuild'?0:1)" "${_DIR}/package.json"; then
    break
  fi
  [ "${_DIR}" = "/" ] && echo "::error::Cannot find Dashbuild root" && exit 1
  _DIR="$(dirname "${_DIR}")"
done
echo "DASHBUILD_ROOT=${_DIR}" >> "$GITHUB_ENV"
