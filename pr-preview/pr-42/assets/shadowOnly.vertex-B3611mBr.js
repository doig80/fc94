import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./sceneUboDeclaration-B5VhSG0v.js";import{$ as n,$t as r,At as i,Qt as a,Tt as o,Zt as s,an as c,at as l,et as u,it as d,jt as f,nn as p,nt as m,on as h,ot as g,rt as _}from"./index-DdGvnLGB.js";var v=`shadowOnlyVertexShader`,y=`precision highp float;attribute vec3 position;
#ifdef NORMAL
attribute vec3 normal;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<instancesDeclaration>
#include<__decl__sceneVertex>
#ifdef POINTSIZE
uniform float pointSize;
#endif
varying vec3 vPositionW;
#ifdef NORMAL
varying vec3 vNormalW;
#endif
#ifdef VERTEXCOLOR
varying vec4 vColor;
#endif
#include<clipPlaneVertexDeclaration>
#include<logDepthDeclaration>
#include<fogVertexDeclaration>
#include<__decl__lightFragment>[0..maxSimultaneousLights]
#if defined(CLUSTLIGHT_BATCH) && CLUSTLIGHT_BATCH>0
varying float vViewDepth;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(position,1.0);gl_Position=viewProjection*worldPos;vPositionW=vec3(worldPos);
#ifdef NORMAL
vNormalW=normalize(vec3(finalWorld*vec4(normal,0.0)));
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
#include<fogVertex>
#include<shadowsVertex>[0..maxSimultaneousLights]
#if defined(POINTSIZE) && !defined(WEBGPU)
gl_PointSize=pointSize;
#endif
#define CUSTOM_VERTEX_MAIN_END
}
`;e.ShadersStore[v]||(e.ShadersStore[v]=y);var b=[h,c,p,o,t,f,l,g,u,n,r,a,s,i,m,d,_];for(let t of b)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var x={name:v,shader:y};export{x as shadowOnlyVertexShader};