source /home/ryanlhu/anaconda3/bin/activate
source /home/ippaklon/emsdk/emsdk_env.sh

cd /var/www/covid-19-hk/client/
cp data/cases.csv LIBKDV_to_Pak_Lon/hk.csv
cd LIBKDV_to_Pak_Lon
python datetime_to_index.py hk.csv cases.csv
emcc -lembind main.cpp alg_visual.cpp baseline.cpp init_visual.cpp SLAM.cpp SWS.cpp EDWIN_multiple.cpp EDWIN_otf.cpp bucket.cpp -O3 -o kdv.js -s EXPORT_NAME=kdv -s -s ALLOW_MEMORY_GROWTH=1 -s WASM=1 -s MODULARIZE=1 -s ENVIRONMENT="worker" --preload-file cases.csv
cp kdv.js ../dist/js/kdv.js
cp kdv.wasm ../dist/js/kdv.wasm
cp kdv.data ../dist/js/kdv.data
cp date_range.js ../src/date_range.js
cd ..
npm run production