#!/Applications/QGIS.app/Contents/MacOS/bin/python3.9
import os
import sys
import time
import pandas as pd
proj_lib_path = "/opt/homebrew/share/proj"
os.environ['PROJ_LIB'] = proj_lib_path
import geopandas as gpd
import numpy as np
import networkx as nx
from shapely.geometry import Point
import qgis
from overpass import *
import osmnx as ox
from qgis.core import *
sys.path.append('/Applications/QGIS.app/Contents/Resources/python/plugins')
from qgis.core import QgsApplication
QgsApplication.setPrefixPath("/Applications/QGIS.app/Contents/MacOS", True)
app = QgsApplication([], False)
app.initQgis() # qt.qpa.fonts: Populating font family aliases took 191 ms. Replace uses of missing font family "Open Sans" with one that exists to avoid this cost.
import processing
from processing.core.Processing import Processing
Processing.initialize()

def update_length(df1, df2):
    df1['length'] = df2['length']


def add_kd_value(gdf, value_se):
    columns_list = gdf.columns.tolist()
    columns_list.append('value')
    gdf = gdf.reindex(columns=columns_list)
    gdf['value'] = value_se
    return gdf


def merge(edges_df, dis_df, nodes_num):
    # df1 is edge dataframe and df2 is distance dataframe
    merge_df = pd.merge(edges_df, dis_df, on=['u_id', 'v_id'], how='left')
    merge_df = merge_df.sort_values(by=['u_id', 'v_id'], ascending=[True, True])
    merge_df = merge_df.reset_index()
    merge_np = merge_df.to_numpy()
    if np.isnan(merge_np[0][4]):  # or we can use merge_np[0][4]>0
        row = [merge_np[0][1], merge_np[0][2], merge_np[0][3], 0]
    else:
        row = [merge_np[0][1], merge_np[0][2], merge_np[0][3], 1, merge_np[0][4]]
    res = []
    for i in range(1, merge_np.shape[0]):
        if merge_np[i][1] == merge_np[i - 1][1] and merge_np[i][2] == merge_np[i - 1][2]:
            row[3] = row[3] + 1
            row.append(merge_np[i][4])
        elif np.isnan(merge_np[i][4]):
            res.append(row)
            row = [merge_np[i][1], merge_np[i][2], merge_np[i][3], 0]
        else:
            res.append(row)
            row = [merge_np[i][1], merge_np[i][2], merge_np[i][3], 1, merge_np[i][4]]
    res.append(row)
    with open('./temp/graph_output', 'w') as fp:
        fp.write("%s " % str(nodes_num))
        fp.write("%s\n" % str(edges_df.shape[0]))
        for list_in in res:
            fp.write("%s " % str(int(list_in[0])))
            fp.write("%s" % str(int(list_in[1])))
            for i in range(2, len(list_in)):
                # write each item on a new line
                fp.write(" %s" % str(list_in[i]))
            fp.write("\n")


def project_data_points_and_generate_points_layer(graph, nodes):
    longitudes = nodes[:, 0]
    latitudes = nodes[:, 1]
    points_list = [Point((lon, lat)) for lon, lat in zip(longitudes, latitudes)]  # turn into shapely geometry
    points = gpd.GeoSeries(points_list,
                           crs='epsg:4326')  # turn into GeoSeries
    points.to_file('./temp/points_layer.gpkg')
    points_proj = points.to_crs(graph.graph['crs'])
    xs = [pp.x for pp in points_proj]
    ys = [pp.y for pp in points_proj]
    nearest_edges = ox.nearest_edges(graph, xs, ys)  # time-consuming
    distances = []
    # print(len(nearest_edges))
    # print(len(longitudes))
    # project data points respectively
    projected_point_list = []

    for i in range(len(longitudes)):
        if i % 10000 == 0:
            pass
            # ("current point: ", i)

        point1_id = nearest_edges[i][0]  # the nearest edge's source node's node id
        point2_id = nearest_edges[i][1]  # the nearest edge's target node's node id

        # generate projection on nearest edge
        data_point = Point(xs[i], ys[i])  # one data point to be projected
        edge = graph.get_edge_data(nearest_edges[i][0], nearest_edges[i][1])[0]['geometry']
        projected_dist = edge.project(data_point)
        projected_point = edge.interpolate(projected_dist)
        projected_point_list.append(projected_point)
        distances.append([point1_id, point2_id, projected_dist])

    points = gpd.GeoSeries(projected_point_list, crs=graph.graph['crs'])
    # print(graph.graph['crs'])
    projected_points = points.to_crs(4326)
    projected_points.to_file('./temp/projected_points_layer.gpkg')

    distances_df = pd.DataFrame(distances, columns=['u_id', 'v_id', 'distance'])
    distances_df = distances_df.sort_values(by=['u_id', 'v_id', 'distance'], ascending=[True, True, True],
                                            ignore_index=True)

    return distances_df


def fix_direction(graph):
    x_dic = {}
    for i, node in enumerate(graph.nodes(data=True)):
        x_dic[i] = node[1]['x']
    for i, edge in enumerate(graph.edges(data=True)):
        shapely_geometry = edge[2]['geometry']
        x, y = shapely_geometry.xy
        if abs(x[0] - x_dic[edge[0]]) > 0.00001:  # edge0 is u (source ID)
            edge[2]['geometry'] = shapely_geometry.reverse()


def process_edges(graph):
    edge_list = []
    for edge in graph.edges:
        node1_id = edge[0]
        node2_id = edge[1]
        length = graph[node1_id][node2_id][0]['length']
        edge_list.append([node1_id, node2_id, length])
    return pd.DataFrame(edge_list, columns=['u_id', 'v_id', 'length'])


def main(argv):
    in_file = argv[1]
    df = pd.read_csv(in_file)
    df = df[['lon', 'lat']]
#     print(df)
    lat_max = df['lat'].max()  # north
    lat_min = df['lat'].min()  # south
    lon_max = df['lon'].max()  # east
    lon_min = df['lon'].min()  # west
#     print("lat_max:{}, lat_min:{}, lon_max:{}, lon_min:{}".format(lat_max, lat_min, lon_max, lon_min))
    # Start downloading map
    start_time = time.time()
    ox.settings.use_cache = False
    query = """
    (
    node["highway"](""" + str(lat_min) + ',' + str(lon_min) + ',' + str(lat_max) + ',' + str(lon_max) + """);
    way["highway"](""" + str(lat_min) + ',' + str(lon_min) + ',' + str(lat_max) + ',' + str(lon_max) + """);
    relation["highway"](""" + str(lat_min) + ',' + str(lon_min) + ',' + str(lat_max) + ',' + str(lon_max) + """);
    );
    (._;>;);
    out body;
        """
    api = API()
    result = api.get(query, verbosity='body', responseformat='xml')
    with open(os.path.join("./temp/testio.xml"), mode="w", encoding='utf-8') as f:
        f.write(result)
    g1 = ox.graph_from_xml(os.path.join("./temp/testio.xml"), simplify=False)
    gc1 = ox.consolidate_intersections(ox.project_graph(g1), tolerance=0.5, rebuild_graph=True) # /Applications/QGIS.app/Contents/MacOS/lib/python3.9/site-packages/osmnx/simplification.py:533: FutureWarning: Setting an item of incompatible dtype is deprecated and will raise in a future error of pandas. Value '2-0' has dtype incompatible with int64, please explicitly cast to a compatible dtype first.
#                                                                                                    gdf.loc[idx, "cluster"] = f"{cluster_label}-{suffix}"
    undi_gc1 = gc1.to_undirected()
    single_undi_gc1 = nx.Graph(undi_gc1)
    g = nx.MultiGraph(single_undi_gc1)
    nodes_num = g.number_of_nodes()
    fix_direction(g)
    end_time = time.time()
    print(f"Downloading map costs: {end_time - start_time}s")
    # End downloading map
    # Start processing edges
    start_time = time.time()
    edge_df = process_edges(g)
    geo_path_1 = './temp/geo1.gpkg'
    ox.save_graph_geopackage(g, geo_path_1) # /Applications/QGIS.app/Contents/MacOS/lib/python3.9/site-packages/osmnx/utils_graph.py:512: FutureWarning: <class 'geopandas.array.GeometryArray'>._reduce will require a `keepdims` parameter in the future
#                                                 dupes = edges[mask].dropna(subset=["geometry"])
    df1 = gpd.read_file(geo_path_1, layer='edges')
    geo_path_2 = './temp/simplified.gpkg'
    df1 = df1[['geometry']]
    df1.to_file(geo_path_2, driver='GPKG', layer='edges')
    add_geometry_2 = processing.run("qgis:exportaddgeometrycolumns",
                                    {'INPUT': geo_path_2 + '|layername=edges', 'CALC_METHOD': 0,
                                     'OUTPUT': "TEMPORARY_OUTPUT"})['OUTPUT']
#                                      ERROR 1: PROJ: proj_create_from_database: Cannot find proj.db
#                                      ERROR 1: PROJ: proj_create_from_database: Cannot find proj.db
#                                      ERROR 1: PROJ: proj_create_from_database: Cannot find proj.db
    length_list = []
    for current, f in enumerate(add_geometry_2.getFeatures()):
          length_list.append([f['length']])

#     print(length_list[0])
    df2 = pd.DataFrame(length_list, columns=['length'])
    # print(type(df2))
    update_length(edge_df, df2)
    end_time = time.time()
    print(f"Processing edges costs: {end_time - start_time}s")
    # End processing edges
    # Start projecting points to the road
    start_time = time.time()
    data_arr = df.to_numpy()
    distance_df = project_data_points_and_generate_points_layer(g, data_arr)
    merge(edge_df, distance_df, nodes_num)
    end_time = time.time()
    print(f"Projecting points costs: {end_time - start_time}s")
    # End projecting points to the road
    # Start splitting roads
    start_time = time.time()
#     qgis_split_output = './temp/split_by_qgis.geojson'
#     processing.run("native:splitlinesbylength", {'INPUT': geo_path_2 + '|layername=edges', 'LENGTH': 50, 'OUTPUT': qgis_split_output}) #Lixel length default 20m
#     crs_transformed_output = './temp/transformed_to_4326.geojson'
#     processing.run("native:reprojectlayer", {
#         'INPUT': qgis_split_output,
#         'TARGET_CRS': 'EPSG:4326',
#         'OUTPUT': crs_transformed_output
#     })
    qgis_split_output = './temp/split_by_20temp.geojson'
    processing.run("native:splitlinesbylength", {'INPUT': geo_path_2 + '|layername=edges', 'LENGTH': 20, 'OUTPUT': qgis_split_output}) #Lixel length default 20m
    crs_transformed_output = './temp/split_by_20.geojson'
    processing.run("native:reprojectlayer", {
        'INPUT': qgis_split_output,
        'TARGET_CRS': 'EPSG:4326',
        'OUTPUT': crs_transformed_output
    })
    qgis_split_output2 = './temp/split_by_50temp.geojson'
    processing.run("native:splitlinesbylength", {'INPUT': geo_path_2 + '|layername=edges', 'LENGTH': 50, 'OUTPUT': qgis_split_output2}) #Lixel length default 50m
    crs_transformed_output2 = './temp/split_by_50.geojson'
    processing.run("native:reprojectlayer", {
        'INPUT': qgis_split_output2,
        'TARGET_CRS': 'EPSG:4326',
        'OUTPUT': crs_transformed_output2
    })
    qgis_split_output3 = './temp/split_by_80temp.geojson'
    processing.run("native:splitlinesbylength", {'INPUT': geo_path_2 + '|layername=edges', 'LENGTH': 80, 'OUTPUT': qgis_split_output3}) #Lixel length default 80m
    crs_transformed_output3 = './temp/split_by_80.geojson'
    processing.run("native:reprojectlayer", {
        'INPUT': qgis_split_output3,
        'TARGET_CRS': 'EPSG:4326',
        'OUTPUT': crs_transformed_output3
    })
    end_time = time.time()
    print(f"Splitting roads costs: {end_time - start_time}s")
    app.exitQgis()



if __name__ == '__main__':
    main(sys.argv)