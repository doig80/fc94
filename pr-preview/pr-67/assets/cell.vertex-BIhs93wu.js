import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./bonesDeclaration-SX_sSZ8J.js";import{t as n}from"./bakedVertexAnimationDeclaration-C-g0vyVW.js";import{t as r}from"./instancesDeclaration-DsiFqYXH.js";import{t as i}from"./instancesVertex-Dty6qjVO.js";import{t as a}from"./bonesVertex-CDLHrzx0.js";import{t as o}from"./bakedVertexAnimation-CP3BNGXM.js";import{t as s}from"./clipPlaneVertexDeclaration-B8LM6QZj.js";import{t as c}from"./clipPlaneVertex-DfQm2Zia.js";import{t as l}from"./fogVertexDeclaration-CiHbVcSR.js";import{t as u}from"./lightVxUboDeclaration-C0zImfsf.js";import{t as d}from"./logDepthDeclaration-BpsZdJ7z.js";import{t as f}from"./fogVertex-D0bmc4KF.js";import{t as p}from"./shadowsVertex-D6v7o28N.js";import{t as m}from"./logDepthVertex-DSD5XdGw.js";import{t as h}from"./vertexColorMixing-UCrnwszu.js";import{t as g}from"./lightVxFragmentDeclaration-YrWmXeNV.js";var _=`cellVertexShader`,v=`attribute position: vec3f;
#ifdef NORMAL
attribute normal: vec3f;
#endif
#ifdef UV1
attribute uv: vec2f;
#endif
#ifdef UV2
attribute uv2: vec2f;
#endif
#ifdef VERTEXCOLOR
attribute color: vec4f;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<instancesDeclaration>
uniform view: mat4x4f;uniform viewProjection: mat4x4f;
#ifdef DIFFUSE
varying vDiffuseUV: vec2f;uniform diffuseMatrix: mat4x4f;uniform vDiffuseInfos: vec2f;
#endif
#ifdef POINTSIZE
uniform pointSize: f32;
#endif
varying vPositionW: vec3f;
#ifdef NORMAL
varying vNormalW: vec3f;
#endif
#ifdef VERTEXCOLOR
varying vColor: vec4f;
#endif
#include<clipPlaneVertexDeclaration>
#include<logDepthDeclaration>
#include<fogVertexDeclaration>
#include<__decl__lightVxFragment>[0..maxSimultaneousLights]
#if defined(CLUSTLIGHT_BATCH) && CLUSTLIGHT_BATCH>0
varying vViewDepth: f32;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input : VertexInputs)->FragmentInputs {
#define CUSTOM_VERTEX_MAIN_BEGIN
#ifdef VERTEXCOLOR
var colorUpdated: vec4f=vertexInputs.color;
#endif
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
var worldPos: vec4f=finalWorld* vec4f(vertexInputs.position,1.0);vertexOutputs.position=uniforms.viewProjection*worldPos;vertexOutputs.vPositionW= worldPos.xyz;
#ifdef NORMAL
vertexOutputs.vNormalW=normalize(( finalWorld* vec4f(vertexInputs.normal,0.0)).xyz);
#endif
#ifndef UV1
var uv: vec2f= vec2f(0.,0.);
#else
var uv: vec2f=vertexInputs.uv;
#endif
#ifndef UV2
var uv2: vec2f= vec2f(0.,0.);
#else
var uv2: vec2f=vertexInputs.uv2;
#endif
#ifdef DIFFUSE
if (uniforms.vDiffuseInfos.x==0.)
{vertexOutputs.vDiffuseUV=(uniforms.diffuseMatrix* vec4f(uv,1.0,0.0)).xy;}
else
{vertexOutputs.vDiffuseUV=(uniforms.diffuseMatrix* vec4f(uv2,1.0,0.0)).xy;}
#endif
#include<clipPlaneVertex>
#include<fogVertex>
#include<shadowsVertex>[0..maxSimultaneousLights]
#include<vertexColorMixing>
#include<logDepthVertex>
#define CUSTOM_VERTEX_MAIN_END
}
`;e.ShadersStoreWGSL[_]||(e.ShadersStoreWGSL[_]=v);var y=[t,n,r,s,d,l,g,u,i,a,o,c,f,p,h,m];for(let t of y)e.IncludesShadersStoreWGSL[t.name]||(e.IncludesShadersStoreWGSL[t.name]=t.shader);var b={name:_,shader:v};export{b as cellVertexShaderWGSL};