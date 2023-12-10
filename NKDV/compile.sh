#/Applications/QGIS.app/Contents/MacOS/bin/python3.9 -m pip install overpass
#/Applications/QGIS.app/Contents/MacOS/bin/python3.9 -m pip install osmnx
#/Applications/QGIS.app/Contents/MacOS/bin/python3.9 -m pip install --upgrade scikit-learn
#/Applications/QGIS.app/Contents/MacOS/bin/python3.9 -m pip install numpy==1.22.4
#chmod +x preProcess.py
./preProcess.py ../data/San_Francisco.csv
emcc -lembind main.cpp alg_NKDV.cpp KAF.cpp shortest_path.cpp -O3 -o nkdv.js -s EXPORT_NAME=nkdv -s -s ALLOW_MEMORY_GROWTH=1 -s WASM=1 -s MODULARIZE=1 -s ENVIRONMENT="worker" --preload-file ./temp/graph_output -s ASSERTIONS=1 -s TOTAL_MEMORY=3221225472

cp nkdv.js ../dist/js/nkdv.js
cp nkdv.wasm ../dist/js/nkdv.wasm
cp nkdv.data ../dist/js/nkdv.data
cp ./temp/split_by_20.geojson ../dist/split_by_20.geojson
cp ./temp/split_by_50.geojson ../dist/split_by_50.geojson
cp ./temp/split_by_80.geojson ../dist/split_by_80.geojson
cd ..
export NODE_OPTIONS=--openssl-legacy-provider
npm run production