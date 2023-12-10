#pragma once
#ifndef ALG_NKDV_H
#define ALG_NKDV_H

#include "shortest_path.h"
#include "KAF.h"

class alg_NKDV
{
public:
	void init_parameters(int argc, char**argv);
	void load_network(char**argv);
	void NKDV_algorithm();
	//void NKDV_compute(int argc, char**argv);
	string NKDV_compute(int argc, char**argv);
	void output_Visual(); //Used for outputting the file
	string output_Visual_String(); //Used for outputting the string
	void clear_memory();
	void clear_basic_memory();

private:
	model our_model;
};

void add_lixels_for_edge(int e, model& our_model);
void obtain_lixel_set(model& our_model);

#endif