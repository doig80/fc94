import{t as e}from"./shaderStore-D-XQlhUT.js";import{$ as t,Dt as n,Ot as r,nt as i,rt as a,tt as o}from"./index-DlZD5Sfz.js";var s=`skyVertexShader`,c=`precision highp float;attribute vec3 position;
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
`;e.ShadersStore[s]||(e.ShadersStore[s]=c);var l=[i,r,a,n,t,o];for(let t of l)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var u={name:s,shader:c};export{u as skyVertexShader};