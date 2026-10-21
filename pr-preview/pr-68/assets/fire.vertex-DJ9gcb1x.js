import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./bonesDeclaration-eZsb-J1W.js";import{n,t as r}from"./bakedVertexAnimation-7XIMgH6x.js";import{t as i}from"./instancesDeclaration-CJBvtBV5.js";import{t as a}from"./instancesVertex-C-FoRQR1.js";import{t as o}from"./bonesVertex-pbyGCQQC.js";import{t as s}from"./clipPlaneVertexDeclaration-BYIpTPFm.js";import{t as c}from"./clipPlaneVertex-DwkrJYmX.js";import{t as l}from"./fogVertexDeclaration-Bb9kDbrL.js";import{t as u}from"./logDepthDeclaration-Dh136csG.js";import{t as d}from"./fogVertex-B90wzaBe.js";import{t as f}from"./logDepthVertex-D5IUM6qd.js";import{t as p}from"./vertexColorMixing-DPW6Is9y.js";var m=`fireVertexShader`,h=`precision highp float;attribute vec3 position;
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
#ifdef DIFFUSE
varying vec2 vDiffuseUV;
#endif
#ifdef POINTSIZE
uniform float pointSize;
#endif
varying vec3 vPositionW;
#ifdef VERTEXCOLOR
varying vec4 vColor;
#endif
#include<clipPlaneVertexDeclaration>
#include<logDepthDeclaration>
#include<fogVertexDeclaration>
uniform float time;uniform float speed;
#ifdef DIFFUSE
varying vec2 vDistortionCoords1;varying vec2 vDistortionCoords2;varying vec2 vDistortionCoords3;
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
vec4 worldPos=finalWorld*vec4(position,1.0);gl_Position=viewProjection*worldPos;vPositionW=vec3(worldPos);
#ifdef DIFFUSE
vDiffuseUV=uv;vDiffuseUV.y-=0.2;
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
#include<fogVertex>
#include<vertexColorMixing>
#if defined(POINTSIZE) && !defined(WEBGPU)
gl_PointSize=pointSize;
#endif
#ifdef DIFFUSE
vec3 layerSpeed=vec3(-0.2,-0.52,-0.1)*speed;vDistortionCoords1.x=uv.x;vDistortionCoords1.y=uv.y+layerSpeed.x*time/1000.0;vDistortionCoords2.x=uv.x;vDistortionCoords2.y=uv.y+layerSpeed.y*time/1000.0;vDistortionCoords3.x=uv.x;vDistortionCoords3.y=uv.y+layerSpeed.z*time/1000.0;
#endif
#define CUSTOM_VERTEX_MAIN_END
}
`;e.ShadersStore[m]||(e.ShadersStore[m]=h);var g=[t,n,i,s,u,l,a,o,r,c,f,d,p];for(let t of g)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var _={name:m,shader:h};export{_ as fireVertexShader};