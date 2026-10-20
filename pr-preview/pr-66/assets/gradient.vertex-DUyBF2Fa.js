import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./bonesDeclaration-eZsb-J1W.js";import{n,t as r}from"./bakedVertexAnimation-7XIMgH6x.js";import{t as i}from"./instancesDeclaration-CJBvtBV5.js";import{t as a}from"./instancesVertex-C-FoRQR1.js";import{t as o}from"./bonesVertex-pbyGCQQC.js";import{t as s}from"./clipPlaneVertexDeclaration-BYIpTPFm.js";import{t as c}from"./clipPlaneVertex-DwkrJYmX.js";import{t as l}from"./fogVertexDeclaration-Bb9kDbrL.js";import{t as u}from"./logDepthDeclaration-Dh136csG.js";import{t as d}from"./fogVertex-B90wzaBe.js";import{t as f}from"./shadowsVertex-CdnfwHqg.js";import{t as p}from"./logDepthVertex-D5IUM6qd.js";import{t as m}from"./lightFragmentDeclaration-BfzJFvAK.js";import{t as h}from"./lightUboDeclaration-0GW0xpMZ.js";import{t as g}from"./vertexColorMixing-DPW6Is9y.js";var _=`gradientVertexShader`,v=`precision highp float;attribute vec3 position;
#ifdef NORMAL
attribute vec3 normal;
#endif
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#ifdef VERTEXCOLOR
attribute vec4 color;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<instancesDeclaration>
uniform mat4 view;uniform mat4 viewProjection;
#ifdef POINTSIZE
uniform float pointSize;
#endif
varying vec3 vPositionW;varying vec3 vPosition;
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
#ifdef VERTEXCOLOR
vec4 colorUpdated=color;
#endif
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(position,1.0);gl_Position=viewProjection*worldPos;vPositionW=vec3(worldPos);vPosition=position;
#ifdef NORMAL
vNormalW=normalize(vec3(finalWorld*vec4(normal,0.0)));
#endif
#ifndef UV1
vec2 uv=vec2(0.,0.);
#endif
#ifndef UV2
vec2 uv2=vec2(0.,0.);
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
#include<fogVertex>
#include<shadowsVertex>[0..maxSimultaneousLights]
#include<vertexColorMixing>
#if defined(POINTSIZE) && !defined(WEBGPU)
gl_PointSize=pointSize;
#endif
#define CUSTOM_VERTEX_MAIN_END
}
`;e.ShadersStore[_]||(e.ShadersStore[_]=v);var y=[t,n,i,s,u,l,m,h,a,o,r,c,p,d,f,g];for(let t of y)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var b={name:_,shader:v};export{b as gradientVertexShader};