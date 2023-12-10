#include "alg_NKDV.h"

void alg_NKDV::init_parameters(int argc, char**argv)
{
	//debug
	/*our_model.network_fileName = (char*)"../../../datasets/testing/testing_network";
	our_model.out_NKDV_fileName = (char*)"Results/testing_M3_K2_L1_b3_v2";
	our_model.method = 3;
	our_model.lixel_reg_length = 1;
	our_model.k_type = 2;
	our_model.bandwidth = 3;*/
	our_model.network_fileName = argv[1];
	our_model.out_NKDV_fileName = argv[2];
	our_model.method = atoi(argv[3]);
	our_model.lixel_reg_length = atoi(argv[4]);
	our_model.k_type = atoi(argv[5]);
	our_model.bandwidth = atof(argv[6]);
	our_model.gamma = 1;

	//Gaussian kernel
	if (our_model.k_type == 0)
		our_model.gamma = 9 / (2 * our_model.bandwidth * our_model.bandwidth);
	//Triangular kernel
	if (our_model.k_type == 1)
		our_model.gamma = 1 / our_model.bandwidth;
	//Epanechnikov and Quartic kernels
	if (our_model.k_type == 2 || our_model.k_type == 3)
		our_model.gamma = 1 / (our_model.bandwidth*our_model.bandwidth);
}

void alg_NKDV::load_network(char**argv)
{
	fstream network_file;
	int num_points;
	//int degree;
	//int edge_index;
	Point p;
	vector<int> tempVector;
	sp_node temp_sp_Node;

	//debug
	//our_model.network_fileName = (char*)"../../../datasets/testing/testing_network";
	//our_model.method = 3;

	our_model.network_fileName = argv[1];
	our_model.method = atoi(argv[3]);

	network_file.open(our_model.network_fileName);
	if (network_file.is_open() == false)
	{
		cout << "Cannot open network file!" << endl;
		exit(0);
	}

	network_file >> our_model.n;
	network_file >> our_model.m;
	our_model.edge_set = new Edge[our_model.m];

	for (int e = 0; e < our_model.m; e++)
	{
		network_file >> our_model.edge_set[e].n1;
		network_file >> our_model.edge_set[e].n2;
		network_file >> our_model.edge_set[e].length;
		network_file >> num_points;

		for (int i = 0; i < num_points; i++)
		{
			p.edge_index = e;
			network_file >> p.dist_n1;
			p.dist_n2 = our_model.edge_set[e].length - p.dist_n1;
			our_model.edge_set[e].PS.push_back(p);
			our_model.edge_set[e].aug_dist_diff_vec.push_back(-inf);
			our_model.edge_set[e].dist_n1_vec.push_back(-1);
			our_model.edge_set[e].dist_n2_vec.push_back(-1);
		}
	}

	//Initialization
	for (int v = 0; v < our_model.n; v++) 
		our_model.Network.push_back(tempVector);

	//Construct the road network
	for (int e = 0; e < our_model.m; e++)
	{
		our_model.Network[our_model.edge_set[e].n1].push_back(e);
		our_model.Network[our_model.edge_set[e].n2].push_back(e);
	}

	//init the Dijkstra's algorithm
	for (int v = 0; v < our_model.n; v++)
	{
		our_model.sp_node_vec.push_back(temp_sp_Node);

		if (our_model.method >= 2 && our_model.method <= 5)
		{
			our_model.sp_node_vec_node_a.push_back(temp_sp_Node);
			our_model.sp_node_vec_node_b.push_back(temp_sp_Node);
		}
	}

	our_model.is_scan_edge_list = new bool[our_model.m];
	for (int e = 0; e < our_model.m; e++)
		our_model.is_scan_edge_list[e] = false;

	network_file.close();
}

void alg_NKDV::NKDV_algorithm()
{
	//Used in method = 2
	int prev_edge_index = -1;
	int num_edge_index = 0;
	int edge_index;

	double run_time;
	//Different algorithms
	auto start_s = chrono::high_resolution_clock::now();
	if (our_model.method == 1) //better version of NKDV baseline method
	{
		for (int l = 0; l < (int)our_model.lixel_set.size(); l++)
		{
			clear_scan_edge_list(our_model);
			our_model.cur_l = our_model.lixel_set[l];
			dijkstra(our_model);
			NKDV_basic(our_model);
			our_model.lixel_set[l] = our_model.cur_l;
		}
	}
	if (our_model.method >= 2 && our_model.method <= 5) //Save the number of calls in dijstra algorithm
	{
		if (our_model.method == 3 || our_model.method == 5)
			augment_preprocess(our_model);
		if (our_model.method == 4 || our_model.method == 5)
			augment_interval_preprocess(our_model);

		for (int l = 0; l < (int)our_model.lixel_set.size(); l++)
		{
			our_model.cur_l = our_model.lixel_set[l];
			edge_index = our_model.lixel_set[l].edge_index;

			if (edge_index != prev_edge_index)
			{
				clear_scan_edge_list(our_model);
				prev_edge_index = edge_index;
				our_model.sel_node_index = our_model.edge_set[edge_index].n1;
				our_model.node_index_pi_a = our_model.sel_node_index;
				dijkstra(our_model);
				copy_sp_info(our_model, true);

				our_model.sel_node_index = our_model.edge_set[edge_index].n2;
				our_model.node_index_pi_b = our_model.sel_node_index;
				dijkstra(our_model);
				copy_sp_info(our_model, false);
			}

			NKDV_basic(our_model);
			our_model.lixel_set[l] = our_model.cur_l;
		}
	}

	auto end_s = chrono::high_resolution_clock::now();

	run_time = (chrono::duration_cast<chrono::nanoseconds>(end_s - start_s).count()) / 1000000000.0;

	std::cout << "method " << our_model.method << ":" << run_time << endl;
}

string alg_NKDV::NKDV_compute(int argc, char**argv)
{
	init_parameters(argc, argv);
	obtain_lixel_set(our_model);
	NKDV_algorithm();
	//output_Visual();

	return output_Visual_String();
}

string alg_NKDV::output_Visual_String()
{
	stringstream outString_ss;
	int edge_index;
	double dist_n1, dist_n2;
	double KDE_value;

	outString_ss << our_model.lixel_set.size() << endl;

	for (int l = 0; l < (int)our_model.lixel_set.size(); l++)
	{
		edge_index = our_model.lixel_set[l].edge_index;
		dist_n1 = our_model.lixel_set[l].dist_n1;
		dist_n2 = our_model.lixel_set[l].dist_n2;
		KDE_value = our_model.lixel_set[l].KDE_value;
		outString_ss << edge_index << " " << dist_n1 << " " << dist_n2 << " " << KDE_value << endl;
	}

	clear_memory();

	return outString_ss.str();
}

void alg_NKDV::output_Visual()
{
	int edge_index;
	double dist_n1, dist_n2;
	double KDE_value;
	fstream out_NKDV_file;

	out_NKDV_file.open(our_model.out_NKDV_fileName, ios::in | ios::out | ios::trunc);
	if (out_NKDV_file.is_open() == false)
	{
		cout << "Cannot open output file!" << endl;
		exit(0);
	}

	out_NKDV_file << our_model.lixel_set.size() << endl;
	for (int l = 0; l < (int)our_model.lixel_set.size(); l++)
	{
		edge_index = our_model.lixel_set[l].edge_index;
		dist_n1 = our_model.lixel_set[l].dist_n1;
		dist_n2 = our_model.lixel_set[l].dist_n2;
		KDE_value = our_model.lixel_set[l].KDE_value;
		out_NKDV_file << edge_index << " " << dist_n1 << " " << dist_n2 << " " << KDE_value << endl;
	}

	out_NKDV_file.close();
	clear_memory();
}

void alg_NKDV::clear_memory()
{
	our_model.lixel_set.clear();
}

void alg_NKDV::clear_basic_memory()
{
	for (int e = 0; e < our_model.m; e++)
	{
		if (our_model.method == 3) //ADA method
		{
			our_model.edge_set[e].dist_n1_vec.clear();
			our_model.edge_set[e].dist_n2_vec.clear();
			our_model.edge_set[e].aug_dist_diff_vec.clear();
			our_model.edge_set[e].PS.clear();
		}
	}

	delete[] our_model.edge_set;

	for (int v = 0; v < our_model.n; v++)
		our_model.Network[v].clear();
	our_model.Network.clear();

	our_model.sp_node_vec.clear();
	if (our_model.method == 3) //ADA method
	{
		our_model.sp_node_vec_node_a.clear();
		our_model.sp_node_vec_node_b.clear();
	}
}

void add_lixels_for_edge(int e, model& our_model)
{
	double cur_dist = 0;
	double middle_dist;
	double next_dist;
	double length = our_model.edge_set[e].length;
	Lixel l;

	while (cur_dist < length)
	{
		next_dist = cur_dist + our_model.lixel_reg_length;
		if (next_dist > length)
			next_dist = length;

		middle_dist = (cur_dist + next_dist) / 2.0;
		l.dist_n1 = middle_dist;
		l.dist_n2 = length - middle_dist;
		l.edge_index = e;
		l.KDE_value = -100;
		our_model.lixel_set.push_back(l);

		cur_dist += our_model.lixel_reg_length;
	}
}

void obtain_lixel_set(model& our_model)
{
	for (int e = 0; e < our_model.m; e++)
		add_lixels_for_edge(e, our_model);
}