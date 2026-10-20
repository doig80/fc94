import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./clipPlaneVertexDeclaration-BYIpTPFm.js";import{t as n}from"./clipPlaneVertex-DwkrJYmX.js";import{t as r}from"./fogVertexDeclaration-Bb9kDbrL.js";import{t as i}from"./logDepthDeclaration-Dh136csG.js";import{t as a}from"./fogVertex-B90wzaBe.js";import{t as o}from"./logDepthVertex-D5IUM6qd.js";var s=`skyVertexShader`,c=`precision highp float;attribute vec3 position;
#ifdef VERTEXCOLOR
attribute vec4 color;
#endif
uniform mat4 world;uniform mat4 view;uniform mat4 viewProjection;
#ifdef POINTSIZE
uniform float pointSize;
#endif
varying vec3 vPositionW;
#ifdef VERTEXCOLOR
varying vec4 vColor;
#endif
#include<logDepthDeclaration>
#include<clipPlaneVertexDeclaration>
#include<fogVertexDeclaration>
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
gl_Position=viewProjection*world*vec4(position,1.0);vec4 worldPos=world*vec4(position,1.0);vPositionW=vec3(worldPos);
#include<clipPlaneVertex>
#include<logDepthVertex>
#include<fogVertex>
#ifdef VERTEXCOLOR
vColor=color;
#endif
#if defined(POINTSIZE) && !defined(WEBGPU)
gl_PointSize=pointSize;
#endif
#define CUSTOM_VERTEX_MAIN_END
}
`;e.ShadersStore[s]||(e.ShadersStore[s]=c);var l=[i,t,r,n,o,a];for(let t of l)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var u={name:s,shader:c};export{u as skyVertexShader};