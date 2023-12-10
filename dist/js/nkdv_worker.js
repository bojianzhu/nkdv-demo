async function compute_nkdv(method, lixel_reg_length, k_type, bandwidth){
    console.log("function start")
    const startTime = new Date();
    const result = await this.lib.compute(method, lixel_reg_length, k_type, bandwidth)
    const endTime = new Date();
    const executionTime = endTime - startTime;
    console.log("function end: Execution time:", executionTime, "ms");
    return result
    // return str2ab(result)
}

function str2ab(str) {
    var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
    var bufView = new Uint8Array(buf);
    for (var i=0, strLen=str.length; i<strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}


self.importScripts("./nkdv.js");
this.lib = 0
this.running_tasks = 0

self.onmessage = async (message) => {

    if (!this.lib) await nkdv().then(instance=>{this.lib = instance;this.ready=true});


    console.log("woker start")
    this.running_tasks += 1

    setTimeout(
        () => compute_nkdv(...message.data).then(result =>{
            this.running_tasks+=-1
            console.log("woker end")
            postMessage(result)
        }),
        0
    );


    // if (this.ready == true){
    //   this.ready=false;
    //   console.log(...message.data)
    //   compute_kdv(...message.data).then(([result,radius]) =>{
    //     postMessage(result,[result])
    //     postMessage(radius)
    //   })
    // }
    //console.log(compute())

    // toArrayBuffer(data).then(arrayBuffer => {

    // postMessage(arrayBuffer,[arrayBuffer])
    // })
};