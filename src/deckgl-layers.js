import {PathLayer} from '@deck.gl/layers';

function getColorByValue(value) {
    const alpha = 188
    if (value < 10) {
        return [0, 255, 0, alpha]; // 绿色
    } else if (value < 30) {
        return [127, 255, 0, alpha]; // 浅绿色
    } else if (value < 100) {
        return [255, 255, 0, alpha]; // 黄色
    } else if (value < 200) {
        return [255, 165, 0, alpha]; // 橙色
    } else if (value < 400) {
        return [255, 69, 0, alpha]; // 橙红色
    } else if (value < 700) {
        return [255, 0, 0, alpha]; // 红色
    } else if (value < 1000) {
        return [178, 34, 34, alpha]; // 暗红色
    } else if (value < 2000) {
        return [139, 0, 0, alpha]; // 深红色
    } else if (value < 4000) {
        return [128, 0, 0, alpha]; // 栗色
    } else {
        return [85, 0, 0, alpha]; // 非常深的红色
    }
}
function transformGeoJSON(lines) {
    if (!lines || !lines.features) {
        // console.error('Invalid or undefined GeoJSON data');
        return [];
    }
    return lines.features.map(feature => {
        const startCoord = feature.geometry.coordinates[0];
        const endCoord = feature.geometry.coordinates[1];
        const value = feature.properties.value;

        return {
            path: [startCoord, endCoord],
            name: "value:"+value,
            color: getColorByValue(value)
        };
    });
}

export function renderLayers(props) {
    const { settings, stNkdv, lines } = props;

    console.log("lines:")
    console.log(lines)
    const data = transformGeoJSON(lines);
    return [

        settings.showNetwork&&new PathLayer({
            id: 'path-layer',
            data,
            pickable: true,
            getWidth: 2,
            getColor: d => d.color,
            getPath: d => d.path,
            widthMinPixels: 2,
            opacity: settings.opacity
        }),

    ];
}

