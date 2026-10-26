import{r as e}from"./rolldown-runtime-hePW80VL.js";import{t}from"./vendor-react-1ZJtk8DY.js";import{jt as n}from"./vendor-lucide-BzN_UfFF.js";import{t as r}from"./vendor-leaflet-CeU7dz_d.js";var i=e(n(),1),a=e(r(),1),o=t(),s=({station:e,vessel:t,currentTideHeight:n,vesselPosition:r,vesselHeading:s,routeWaypoints:c,onMapClickAddWaypoint:l,showHazards:u,showSeamarks:d,anchorWatchActive:f,anchorPosition:p,anchorRadius:m,anchorStatus:h,driftTrail:g,isSettingAnchorByClick:_=!1,onMapClickSetAnchor:v})=>{let y=(0,i.useRef)(null),b=(0,i.useRef)(null),x=(0,i.useRef)(null),S=(0,i.useRef)(null),C=(0,i.useRef)(null),w=(0,i.useRef)(null),T=(0,i.useRef)(null),E=(0,i.useRef)(_);E.current=_;let D=(0,i.useRef)(v);D.current=v;let O=(0,i.useRef)(l);O.current=l;let k=(0,i.useRef)(c.length);return k.current=c.length,(0,i.useEffect)(()=>{if(y.current){if(b.current)b.current.setView([e.lat,e.lng],13);else{let t=a.default.map(y.current,{center:[e.lat,e.lng],zoom:13,zoomControl:!1,attributionControl:!1});a.default.control.zoom({position:`topright`}).addTo(t),a.default.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`,{maxZoom:18,subdomains:`abcd`}).addTo(t);let n=a.default.tileLayer(`https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png`,{maxZoom:18,opacity:.9});d&&n.addTo(t),C.current=n;let r=a.default.layerGroup().addTo(t),i=a.default.layerGroup().addTo(t),o=a.default.layerGroup().addTo(t);x.current=r,S.current=i,w.current=o,b.current=t,t.on(`click`,e=>{if(E.current&&D.current){D.current([e.latlng.lat,e.latlng.lng]);return}let t={id:`wp-${Date.now()}`,name:`Ponto ${k.current+1}`,lat:e.latlng.lat,lng:e.latlng.lng,chartedDepth:Math.max(1.8,Math.round((2.5+Math.random()*8)*10)/10)};O.current(t)})}}},[e]),(0,i.useEffect)(()=>{b.current&&C.current&&(d?b.current.hasLayer(C.current)||C.current.addTo(b.current):b.current.hasLayer(C.current)&&b.current.removeLayer(C.current))},[d]),(0,i.useEffect)(()=>()=>{b.current&&(b.current.remove(),b.current=null,x.current=null,S.current=null,C.current=null,w.current=null,T.current=null)},[]),(0,i.useEffect)(()=>{if(!b.current||!x.current)return;let r=x.current;r.clearLayers(),u&&e.hazards.forEach(e=>{let i=Math.round((e.chartedDepth+n)*10)/10,o=Math.round((i-t.draft)*10)/10,s=o<.5,c=`
        <div style="
          background: ${e.type===`lighthouse`?`#111111`:s?`#d42020`:`#444444`};
          color: white;
          width: 26px;
          height: 26px;
          border: 2px solid #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: monospace;
          font-weight: bold;
          font-size: 11px;
          box-shadow: 2px 2px 0px #000000;
          cursor: pointer;
        ">
          ${e.type===`lighthouse`?`FL`:e.type===`rock`?`▲`:`●`}
        </div>
      `,l=a.default.divIcon({html:c,className:`tactical-hazard-pin`,iconSize:[26,26],iconAnchor:[13,13]}),u=a.default.marker([e.lat,e.lng],{icon:l}),d=`
        <div style="font-family: monospace; font-size: 11px; min-width: 180px;">
          <div style="font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">${e.name}</div>
          <div style="color: #666; font-size: 10px; margin-bottom: 6px;">${e.description}</div>
          <div style="border-top: 1px solid #000; padding-top: 4px;">
            <div>PROF. NA CARTA: <b>${e.chartedDepth.toFixed(1)}m</b></div>
            <div>PROF. REAL COM MARÉ: <b>${i.toFixed(1)}m</b></div>
            <div style="color: ${o<.5?`#d42020`:`#008800`}; font-weight: bold; margin-top: 2px;">
              ESPAÇO SOB A QUILHA: ${o.toFixed(1)}m ${o<.5?`[ÁGUA RASA / PERIGO]`:`[ÁGUA SEGURA]`}
            </div>
          </div>
        </div>
      `;u.bindPopup(d),r.addLayer(u);let f=a.default.circle([e.lat,e.lng],{radius:500,color:`#d42020`,weight:1.5,dashArray:`5, 5`,fillColor:`#d42020`,fillOpacity:.08});f.bindTooltip(`🚨 Geocerca de Perigo (500m): ${e.name} [Prof: ${e.chartedDepth.toFixed(1)}m]`,{sticky:!0}),r.addLayer(f)})},[e,n,t.draft,u]),(0,i.useEffect)(()=>{if(!b.current||!S.current)return;let e=S.current;if(e.clearLayers(),c.length===0)return;let r=c.map(e=>[e.lat,e.lng]),i=a.default.polyline(r,{color:`#000000`,weight:3,dashArray:`6 4`,opacity:.9});e.addLayer(i),c.forEach((r,i)=>{let o=Math.round((r.chartedDepth+n)*10)/10,s=Math.round((o-t.draft)*10)/10,c=s>=t.safetyMargin,l=a.default.divIcon({html:`
          <div style="
            background: ${c?`#111111`:`#d42020`};
            color: white;
            font-size: 10px;
            font-weight: bold;
            font-family: monospace;
            width: 20px;
            height: 20px;
            border: 2px solid #000000;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 2px 2px 0px #000;
          ">
            ${i+1}
          </div>
        `,className:`tactical-wp-marker`,iconSize:[20,20],iconAnchor:[10,10]}),u=a.default.marker([r.lat,r.lng],{icon:l});u.bindPopup(`
        <div style="font-family: monospace; font-size: 11px;">
          <b>${r.name}</b><br/>
          Prof. Carta: ${r.chartedDepth.toFixed(1)}m<br/>
          Prof. Real com Maré: <b>${o.toFixed(1)}m</b><br/>
          Folga sob o Casco: <b style="color:${c?`#008800`:`#d42020`}">${s.toFixed(1)}m</b>
        </div>
      `),e.addLayer(u)})},[c,n,t.draft,t.safetyMargin]),(0,i.useEffect)(()=>{if(!b.current||!w.current)return;let e=w.current;if(e.clearLayers(),!f)return;let t=p||r,n=h===`alarm`?`#d42020`:h===`warning`?`#d97706`:`#008800`,i=h===`alarm`?`#ef4444`:h===`warning`?`#f59e0b`:`#10b981`,o=h===`alarm`?.28:h===`warning`?.18:.12,s=a.default.circle(t,{radius:m,color:n,fillColor:i,fillOpacity:o,weight:h===`alarm`?3.5:2.5,dashArray:h===`alarm`?`3 3`:`6 4`});e.addLayer(s);let c=`
      <div style="
        background: #111111;
        color: #ffffff;
        width: 32px;
        height: 32px;
        border: 2px solid ${h===`alarm`?`#d42020`:`#ffffff`};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 2px 2px 0px #000000;
        cursor: pointer;
      ">
        ⚓
      </div>
    `,l=a.default.divIcon({html:c,className:`tactical-anchor-marker`,iconSize:[32,32],iconAnchor:[16,16]}),u=a.default.marker(t,{icon:l});u.bindPopup(`
      <div style="font-family: monospace; font-size: 11px; min-width: 170px;">
        <div style="font-weight: bold; text-transform: uppercase;">⚓ PONTO FIXO DA ÂNCORA</div>
        <div style="color: #666; font-size: 10px; margin-top: 2px;">
          LAT: ${t[0].toFixed(5)}<br/>
          LNG: ${t[1].toFixed(5)}
        </div>
        <div style="border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
          RAIO DE BORNEIO: <b>${m} METROS</b>
        </div>
      </div>
    `),e.addLayer(u);let d=a.default.polyline([t,r],{color:h===`alarm`?`#d42020`:`#333333`,weight:2,dashArray:`3 4`,opacity:.85});if(e.addLayer(d),g&&g.length>1){let t=g.map(e=>[e.lat,e.lng]),n=a.default.polyline(t,{color:`#0284c7`,weight:2,opacity:.65});e.addLayer(n)}},[f,p,m,h,r,g]),(0,i.useEffect)(()=>{if(!b.current)return;let e=`
      <div style="transform: rotate(${s}deg); transition: transform 0.4s ease;">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" fill="#ffffff" fill-opacity="0.8" stroke="#000000" stroke-width="2"/>
          <path d="M16 4 L24 24 L16 19 L8 24 Z" fill="${h===`alarm`?`#d42020`:`#111111`}" stroke="#000000" stroke-width="1.8"/>
        </svg>
      </div>
    `,t=a.default.divIcon({html:e,className:`tactical-vessel-marker`,iconSize:[32,32],iconAnchor:[16,16]});if(T.current)T.current.setLatLng(r),T.current.setIcon(t);else{let e=a.default.marker(r,{icon:t,zIndexOffset:1e3}).addTo(b.current);T.current=e}},[r,s,h]),(0,o.jsx)(`div`,{ref:y,className:`w-full h-full`})};export{s as LeafletNauticalMap,s as default};