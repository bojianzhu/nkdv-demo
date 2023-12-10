/* global window */
import React, { Component} from 'react';
import {Map} from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import { LayerControls, Abouts, Menu, Header, Footer, LatestUpdate, MapStylePicker,SCATTERPLOT_CONTROLS } from './controls';
import { tooltipStyle } from './style';
import DeckGL from 'deck.gl';
import {renderLayers } from './deckgl-layers';
import {WebMercatorViewport} from '@deck.gl/core';
import { addDays } from 'date-fns';
import RangeInput from './range-input';
import './app.css'
import 'mapbox-gl/dist/mapbox-gl.css';
import {date_to_index,max_date,st_date} from './date_range.js'

import intl from 'react-intl-universal';
import {emit} from "./emit.js"


const locales = {
    "en": require('./locales/en_nkdv.json'),
    "zh": require('./locales/zh_nkdv.json')
 };
intl.init({
     currentLocale: 'en',
     locales
})


const API_TOKEN = "c721d12c7b7f41d2bfc7d46a796b1d50";
const FIRSTDATE = new Date(st_date*1000)

const hk_bound = [113.8321,114.4501,22.1416,22.5760]

const bound = hk_bound

function isPC() {
  var userAgentInfo = navigator.userAgent;
  var Agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPod"];
  var flag = true;
  for (var i = 0; i < Agents.length; i++) {
      if (userAgentInfo.indexOf(Agents[i]) > 0) {
          flag = false;
          break;
      }
  }
  return flag;
};

function formatLabel(t) {

  const d = addDays(FIRSTDATE,t+1)
  const year = d.getUTCFullYear().toString()
  const date = (d.getUTCDate()).toString()
  const month = (d.getUTCMonth()+1).toString()

  return `${date+'/'+month+'/'+year}`;
}

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const lon = urlParams.get('lon')?parseFloat(urlParams.get('lon')):-122.4359965
const lat = urlParams.get('lat')?parseFloat(urlParams.get('lat')):37.759598
const zoom = urlParams.get('zoom')?parseFloat(urlParams.get('zoom')):null



const SF_VIEW_STATE = {
  longitude: lon,
  latitude: lat,
  zoom: zoom?zoom:11.5,
  minZoom: 1,
  maxZoom: 50,
  pitch: 0,
  bearing: 0,
};

const INITIAL_VIEW_STATE = SF_VIEW_STATE

function setCookie(cname,cvalue,exdays)
{
  var d = new Date();
  d.setTime(d.getTime()+7*(exdays*24*60*60*1000));
  var expires = "expires="+d.toGMTString();
  document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname)
{
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for(var i=0; i<ca.length; i++) 
  {
    var c = ca[i].trim();
    if (c.indexOf(name)==0) return c.substring(name.length,c.length);
  }
  return "";
}

function ab2str(buf) {
  return new TextDecoder('utf-8').decode(new Uint8Array(buf));
}

function parseStrData(strData) {
  const lines = strData.trim().split('\n');
  var max = 0;
  const values = lines.slice(1).map(line => {
    const parts = line.trim().split(/\s+/);
    const value = parseFloat(parts[parts.length - 1])
    if(value > max){
      max = value;
    }
    return value;
  });
  return {kdeValues: values, max: max};
}
function addKdValueToGeoJSON(geojsonData, kdeValues) {
  geojsonData.features.forEach((feature, index) => {
    if (index < kdeValues.length) {
      feature.properties.value = kdeValues[index];
    }
    delete feature.properties.fid;
  });
  return geojsonData;
}

export default class App extends Component {
  constructor(props) {
    super(props);
  this.state = {
    hover:{
      x:0,
      y:0,
      hoveredObject: null
    },
    points: [],
    settings: Object.keys(SCATTERPLOT_CONTROLS).reduce(
      (accu, key) => ({
        ...accu,
        [key]: SCATTERPLOT_CONTROLS[key].value
      }),
      {}
    ),

    filter:Math.floor((addDays(FIRSTDATE,0)-FIRSTDATE)/(1000*24*60*60)),
    viewState: INITIAL_VIEW_STATE,
    bound:[0,180,0,180],
    currentStyle: 'meth_1',
    method:'0',
    max: 100,
    bandwidth:200,
    radius:1,
    showLayers: false,
    showSettings: false,
    showAbouts: false,
    fullScreen: false,
    compute:0,
    init_lon:lon,
    init_lat:lat,
    lang:'en',
    busy:false,
    style:'https://maps.geoapify.com/v1/styles/positron/style.json?apiKey='+API_TOKEN,

    
    changeLayer: "Light",
    selectionRange : {
      startDate:  addDays(FIRSTDATE,0),
      endDate: addDays(FIRSTDATE, max_date-1),
      color: 'rgba(0,44,85,0.87)',
      autoFocus: true,
      key: 'selection',
      showDateDisplay: false,
    },
    openCalendar: false,
    showModal: false,
    modalIndex: 0,
  
  };


  this.getCursor = this.getCursor.bind(this);


  const visited=getCookie("visited");
  if (visited==""){
    //this.state.showModal = true
    setCookie("visited",1,1);
  }


  const time = new Date().getHours()
  this.state.style = 'https://api.maptiler.com/maps/7885a61f-e4cb-466c-a736-4dbf060c2270/style.json?key=zCrGI4RKkWAugUfCSlE1'
  //this.setState({style})


  // var factory = require('./kdv.js');
  // //this.setState({kdv: 2})
  // factory().then(instance => {
    
  //   let compute = instance.compute
  //   instance.load_data()
  //   let MemFS = instance.FS
  //   this.state.compute = compute
  //   this.state.MemFS = MemFS
  //   this.state.settings.runFlag = true;
  // })

  this.worker = new Worker("./js/nkdv_worker.js");
  this.worker.onmessage = (msg) => {
    if (typeof(msg.data) == 'number'){
    this.updateRadius(msg.data)
    }
    else{
      // fs.writeFile('hello.csv',msg.data)
      // fs.readFile('')

      // console.log("result:msg.data")
      // console.log(msg.data)
      const { kdeValues, max} = parseStrData(msg.data)
      this.setMax(max)
      let qgis_split_output;
      if(this.state.settings.lixel_length === 20 ){
         qgis_split_output = "/split_by_20.geojson";
      }else if(this.state.settings.lixel_length === 50){
        qgis_split_output = "/split_by_50.geojson";
      }else if(this.state.settings.lixel_length === 80){
        qgis_split_output = "/split_by_80.geojson";
      }else{
        qgis_split_output = "/transformed_to_4326.geojson"
      }

      fetch(qgis_split_output)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log(response)
            return response.json();
          })
          .then(geojsonData => {
            // console.log("Before:")
            // console.log(geojsonData)
            const geoJSON = addKdValueToGeoJSON(geojsonData, kdeValues)
            console.log("After:")
            console.log(geoJSON)
            this.setData(geoJSON)
          })
          .catch(error => {
            console.error('There has been a problem with your fetch operation:', error);
          });

      // console.log("strData:")
      // const strData = ab2str(msg.data)
      // console.log(strData)

      // parse(msg.data,CSBVLoader).then((response)=>{
      //
      //   // this.setData(response)
      //   console.log("response:")
      //   console.log(response)
      // })
    }
  
    this.setState({busy:false})
    
    // load(msg.data, CSVLoader).then((response)=>{
    //   console.log(response)
    //   this.setData(response)
    //   this.updateRadius(Math.round((long_L-long_U)*-10000)/resolution*1.15)
    // })
  };



}


  getDateRange(){
    if (this.state.settings.stKdv==false)
    return [
      (date_to_index[1]-date_to_index[0])*(7)+
      date_to_index[
        Math.min(max_date,Math.max(0,Math.floor((this.state.selectionRange.startDate-FIRSTDATE)/(1000*24*60*60))))
      ],
      (date_to_index[1]-date_to_index[0])*(7)+1+
      date_to_index[
        Math.min(max_date,Math.floor((this.state.selectionRange.endDate-FIRSTDATE)/(1000*24*60*60))+1)
      ]
    ]
    else return [
      (date_to_index[1]-date_to_index[0])*(7-this.state.settings.bandwidth_t)+
      date_to_index[
        Math.min(max_date,Math.max(0,Math.floor((this.state.selectionRange.startDate-FIRSTDATE)/(1000*24*60*60))))
      ],
      (date_to_index[date_to_index.length-1]-date_to_index[date_to_index.length-2])*this.state.settings.bandwidth_t+
      (date_to_index[1]-date_to_index[0])*(7)+
      date_to_index[
        Math.min(max_date,Math.floor((this.state.selectionRange.endDate-FIRSTDATE)/(1000*24*60*60))+1)
      ]
    ]
  }




  getDate(){
    return this.state.settings.date
  }
  setData(lines){
    this.setState({
      lines
    });
  };

  setMax(max){
    this.setState({
      max
    })
  }
  updateRadius = radius => {
    this.setState({radius})
  }

  updateShowLayers = () => {
    this.setState({
      showLayers: !this.state.showLayers,
      showSettings: false,
      showAbouts: false
    });
  }
  updateShowSettings = () => {
    this.setState({
      showSettings: !this.state.showSettings,
      showLayers: false,
      showAbouts: false
    });
  }
  updateShowAbouts = () => {
    this.setState({
      showAbouts: !this.state.showAbouts,
      showLayers: false,
      showSettings: false
    });
  }
  updateFullScreen = () => {
    this.setState({
      fullScreen: !this.state.fullScreen
    });
  }
  updateMenu = () => {
    this.setState({
      showAbouts: false,
      showLayers: false,
      showSettings: false
    });
  }
  updateChangeLayer = (layer) => {
    this.setState({
      changeLayer: layer
    });
  }

  updateOpenCalendar = () => {
    this.setState({
      openCalendar: !this.state.openCalendar,
    });
  }
  updateSelectionRange = (selection) => {
    this.setState({
      selectionRange: selection
    });
  }
  
  updateFilter = filter =>{
    this.setState({filter})
  };

  onStyleChange = style => {
    this.setState({ style });
  };
  onMethodChange = method => {
    this.setState({ method });
  };

  updateShowModal = () => {
    this.setState({
      showModal: false
    });
  }
  updateModalIndex = () => {
    if (this.state.modalIndex != 2) {
      this.setState({
        modalIndex: this.state.modalIndex + 1
      })
    } else {
      this.setState({
        modalIndex: 0
      })
    }
  
  }

  _updateLayerSettings(settings) {
    this.setState({ settings });
  };


  componentDidMount(){
    document.title = 'San Francisco Taxi Pickup';
    emit.on('change_language',lang => this.loadLocales(lang));
    this.loadLocales();
    this.compute_nkdv();
  }  

  loadLocales = (lang = "en") =>{
    intl.init({
      currentLocale: lang,
      locales
    })
  }

  changeLanguage = () =>{
    let next_lang = this.state.lang=='en'?'zh':'en'
    emit.emit('change_language',next_lang)
    this.setState({lang:next_lang})
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.state.settings.stKdv !== prevState.settings.stKdv){
      if (this.state.settings.stKdv==true){
        var new_settings = this.state.settings
        new_settings.Resolution=1
        //this._updateLayerSettings(new_settings)
      }
      else{
        var new_settings = this.state.settings
        new_settings.Resolution=isPC()?3:2
      }
    }
    if ((this.state.settings.bandwidth !== prevState.settings.bandwidth) ||
        (this.state.settings.lixel_length !== prevState.settings.lixel_length)
    ) {
      this.compute_nkdv()
    }
    // if ((this.state.settings.bandwidth !== prevState.settings.bandwidth) ||
    //   (this.state.settings.Resolution !== prevState.settings.Resolution) ||
    //   (this.state.settings.stKdv !== prevState.settings.stKdv) ||
    //   (this.state.selectionRange !== prevState.selectionRange) ||
    //   (this.state.settings.bandwidth_t !== prevState.settings.bandwidth_t)
    //   ) {
    //   this.compute_nkdv({viewState: this.state.viewState})
    // }
  }

  
  compute_nkdv = () =>{
    if (this.state.busy) return
    // const input_fileName = "/temp/graph_output"
    // const output_fileName = "nkvd_result"
    const method = 3  // method 3: ADA
    const lixel_reg_length = this.state.settings.lixel_length
    const kernel_type = 2  // kernel 2: Epanechnikov kernel
    const bandwidth = this.state.settings.bandwidth
    console.log("lixel length:"+this.state.settings.lixel_length)
    console.log("bandwidth:"+this.state.settings.bandwidth)
    try{
      console.log("start")
      this.worker.postMessage([method, lixel_reg_length, kernel_type, bandwidth])

    }
    catch(e){
    }
      this.setState({busy:true})
    
    // const buffer = Buffer.from(this.state.MemFS.readFile('./tmp.bin'))
    // var tik = performance.now()
    // load(buffer, CSVLoader).then((response)=>{
    //   this.setData(response)
    
    //   this.updateRadius(Math.round((long_L-long_U)*-10000)/resolution*1.15)
    // })
    //var tok = performance.now()
    //load(result)


  }

  getCursor = (h) =>{
    if (this.state.busy) return 'wait'
    else if (h.isDragging)
    return 'grabbing'
    else{
      return 'grab'
    }

  }




  render() {
    const data = this.state.points;

    if (!data.length) {
      // return null;
    }
    return (
        <div>
          <Header
            changeLanguage = {this.changeLanguage}
            fullScreen={this.state.fullScreen}
          />

          
          { this.state.showLayers ? <MapStylePicker
            onStyleChange={this.onStyleChange}
            currentStyle={this.state.style}
            changeLayer={this.state.changeLayer}
            buttonClick={this.updateChangeLayer}
            updateShowLayers={this.updateShowLayers}
          /> : null }


          { this.state.showSettings ? <LayerControls
            settings={this.state.settings}
            propTypes={SCATTERPLOT_CONTROLS}
            onChange={settings => this._updateLayerSettings(settings)}
            updateShowSettings={this.updateShowSettings}
            updateSelectionRange={this.updateSelectionRange}
            selectionRange={this.state.selectionRange}
            openCalendar={this.state.openCalendar}
            updateOpenCalendar={this.updateOpenCalendar}
          /> : null }


          { this.state.showAbouts ? <Abouts
            updateShowAbouts={this.updateShowAbouts}
          /> : null }
          {/* <LayerControls
            settings={this.state.settings}
            propTypes={SCATTERPLOT_CONTROLS}
            onChange={settings => this._updateLayerSettings(settings)}
          /> */}
          
          {/* <Abouts/> */}
          {/* <div className="test"> */}
          {/* <DeckGL  style={{ top: '120px !important', width: '100%', height: 'calc(100vh - 210px)',  }} */}
          <DeckGL getCursor={this.getCursor}style={{ top: '120px !important', width: '100%'}}
          {...this.state.settings}

          _typedArrayManagerProps= {{overAlloc: 1, poolSize: 0}}

          controller =  {{scrollZoom: {speed:0.003},smooth:true}}

          layers={renderLayers({
            settings: this.state.settings,
            lines: this.state.lines
          })}
          getTooltip={({object}) => object && object.name}
        
          initialViewState={INITIAL_VIEW_STATE}
        >
          
          <Map 
          mapLib={maplibregl}
          mapStyle={this.state.style}

          />
        </DeckGL>
          {/* <Legend 
            width={window.innerWidth*0.4} height={50} style = {colourStyle}>
            fullScreen={this.state.fullScreen}
          </Legend> */}
          <Menu
              updateMenu={this.updateMenu}
              updateShowLayers={this.updateShowLayers}
              updateShowSettings={this.updateShowSettings}
              updateShowAbouts={this.updateShowAbouts}
              updateFullScreen={this.updateFullScreen}
          />


          <LatestUpdate 
            fullScreen={this.state.fullScreen}
          />

          <script
            type="module"
            src="color-legend-element/build/color-legend-element.js"
          ></script>

          <Footer 
            fullScreen={this.state.fullScreen}
          />
          {
          this.state.settings.stKdv && (
          <RangeInput
            min={Math.floor((this.state.selectionRange.startDate-FIRSTDATE)/(1000*24*60*60))}
            max={Math.floor((this.state.selectionRange.endDate-FIRSTDATE)/(1000*24*60*60))}
            value={this.state.filter}

            animationSpeed={0.5*1/24*(Math.floor((this.state.selectionRange.endDate-FIRSTDATE)/(1000*24*60*60))-Math.floor((this.state.selectionRange.startDate-FIRSTDATE)/(1000*24*60*60))+1)/7}
            formatLabel={formatLabel}
            onChange={(filter)=> this.updateFilter(filter)}
          />)
          }
          
        </div>

    );
  }

}

