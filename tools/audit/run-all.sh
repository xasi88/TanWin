#!/bin/bash
# Полный прогон перед выпуском: все уроки четырьмя потоками + дополнительные экраны + разные устройства.
cd "$(dirname "$0")/../.."
L=tools/audit/logs
run() { name=$1; shift; timeout 1500 node tools/audit/audit.mjs --out $name --show 60 "$@" > $L/$name.log 2>&1; }
(for u in 1. 2. 3.; do run les-$u --nopages --lessons $u; done) &
(for u in 4. 5. 6. 7.; do run les-$u --nopages --lessons $u; done) &
(for u in 8. 9. 10.; do run les-$u --nopages --lessons $u; done) &
(for u in 11. 12. 13.; do run les-$u --nopages --lessons $u; done) &
(run extra --nopages --extra; run showcase --nopages --showcase; run extra-ty --nopages --extra --form ty --gender f) &
(run p-320 --pages --width 320; run p-1280 --pages --width 1280; run p-dark --pages --theme dark; run p-webkit --pages --engine webkit; run p-max --pages --ar 2.4 --ui 1.4; run p-768 --pages --width 768; run p-ty --pages --form ty --gender f) &
wait
tail -n 100 $L/*.log
