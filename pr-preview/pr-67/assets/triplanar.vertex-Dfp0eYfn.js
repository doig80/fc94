import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./bonesDeclaration-eZsb-J1W.js";import{n,t as r}from"./bakedVertexAnimation-7XIMgH6x.js";import{t as i}from"./instancesDeclaration-CJBvtBV5.js";import{t as a}from"./instancesVertex-C-FoRQR1.js";import{t as o}from"./bonesVertex-pbyGCQQC.js";import{t as s}from"./helperFunctions-D8vur8CW.js";import{t as c}from"./clipPlaneVertexDeclaration-BYIpTPFm.js";import{t as l}from"./clipPlaneVertex-DwkrJYmX.js";import{t as u}from"./fogVertexDeclaration-Bb9kDbrL.js";import{t as d}from"./logDepthDeclaration-Dh136csG.js";import{t as f}from"./fogVertex-B90wzaBe.js";import{t as p}from"./shadowsVertex-CdnfwHqg.js";import{t as m}from"./logDepthVertex-D5IUM6qd.js";import{t as h}from"./lightFragmentDeclaration-BfzJFvAK.js";import{t as g}from"./lightUboDeclaration-0GW0xpMZ.js";import{t as _}from"./vertexColorMixing-DPW6Is9y.js";var v=`triplanarVertexShader`,y=`precision highp float;attribute vec3 position;
#ifdef NORMAL
attribute vec3 normal;
#endif
#ifdef VERTEXCOLOR
attribute vec4 color;
#endif
#include<helperFunctions>
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<instancesDeclaration>
uniform mat4 view;uniform mat4 viewProjection;
#ifdef DIFFUSEX
varying vec2 vTextureUVX;
#endif
#ifdef DIFFUSEY
varying vec2 vTextureUVY;
#endif
#ifdef DIFFUSEZ
varying vec2 vTextureUVZ;
#endif
uniform float tileSize;
#ifdef POINTSIZE
uniform float pointSize;
#endif
varying vec3 vPositionW;
#ifdef NORMAL
varying mat3 tangentSpace;
#endif
#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
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
void main(void)
{
#define CUSTOM_VERTEX_MAIN_BEGIN
#ifdef VERTEXCOLOR
vec4 colorUpdated=color;
#endif
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(position,1.0);gl_Position=viewProjection*worldPos;vPositionW=vec3(worldPos);
#ifdef DIFFUSEX
vTextureUVX=worldPos.zy/tileSize;
#endif
#ifdef DIFFUSEY
vTextureUVY=worldPos.xz/tileSize;
#endif
#ifdef DIFFUSEZ
vTextureUVZ=worldPos.xy/tileSize;
#endif
#ifdef NORMAL
vec3 xtan=vec3(0,0,1);vec3 xbin=vec3(0,1,0);vec3 ytan=vec3(1,0,0);vec3 ybin=vec3(0,0,1);vec3 ztan=vec3(1,0,0);vec3 zbin=vec3(0,1,0);vec3 normalizedNormal=normalize(normal);normalizedNormal*=normalizedNormal;vec3 worldBinormal=normalize(xbin*normalizedNormal.x+ybin*normalizedNormal.y+zbin*normalizedNormal.z);vec3 worldTangent=normalize(xtan*normalizedNormal.x+ytan*normalizedNormal.y+ztan*normalizedNormal.z);mat3 normalWorld=mat3(finalWorld);
#ifdef NONUNIFORMSCALING
normalWorld=transposeMat3(inverseMat3(normalWorld));
#endif
worldTangent=normalize((normalWorld*worldTangent).xyz);worldBinormal=normalize((normalWorld*worldBinormal).xyz);vec3 worldNormal=normalize((normalWorld*normalize(normal)).xyz);tangentSpace[0]=worldTangent;tangentSpace[1]=worldBinormal;tangentSpace[2]=worldNormal;
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
`;e.ShadersStore[v]||(e.ShadersStore[v]=y);var b=[s,t,n,i,c,d,u,h,g,a,o,r,l,m,f,p,_];for(let t of b)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var x={name:v,shader:y};export{x as triplanarVertexShader};