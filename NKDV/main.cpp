#include "alg_NKDV.h"
#include <emscripten/bind.h>
#include <emscripten/val.h>


using namespace emscripten;

char empty1[] = " ";
std::string compute(int method, int lixel_reg_length, int k_type, float bandwidth)
{
    char pa1[32]= "./temp/graph_output";
    char pa2[32]= "nkvd_result";

    char pa3[32]= "3";
    sprintf(pa3,"%d", method);
    char pa4[32]= "1";
    sprintf(pa4,"%d",lixel_reg_length);
    char pa5[32]= "2";
    sprintf(pa5,"%d",k_type);
    char pa6[32]= "3";
    sprintf(pa6,"%.10f",bandwidth);

    char *argv_load[] = {empty1, pa1, pa2, pa3, pa4, pa5, pa6};
	alg_NKDV algorithm;
	algorithm.load_network(argv_load);
	std::string result = algorithm.NKDV_compute(7, argv_load);
	algorithm.clear_basic_memory();
	return result;
}


EMSCRIPTEN_BINDINGS(module) {
  emscripten::function("compute", &compute);
}