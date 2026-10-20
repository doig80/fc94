import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./bonesDeclaration-SX_sSZ8J.js";import{t as n}from"./bakedVertexAnimationDeclaration-C-g0vyVW.js";import{t as r}from"./instancesDeclaration-DsiFqYXH.js";import{t as i}from"./instancesVertex-Dty6qjVO.js";import{t as a}from"./bonesVertex-CDLHrzx0.js";import{t as o}from"./bakedVertexAnimation-CP3BNGXM.js";import{t as s}from"./sceneUboDeclaration-B96Tfx7b.js";import{t as c}from"./clipPlaneVertexDeclaration-B8LM6QZj.js";import{t as l}from"./clipPlaneVertex-DfQm2Zia.js";import{t as u}from"./fogVertexDeclaration-CiHbVcSR.js";import{t as d}from"./lightVxUboDeclaration-C0zImfsf.js";import{t as f}from"./logDepthDeclaration-BpsZdJ7z.js";import{t as p}from"./fogVertex-D0bmc4KF.js";import{t as m}from"./shadowsVertex-D6v7o28N.js";import{t as h}from"./logDepthVertex-DSD5XdGw.js";import{t as g}from"./lightVxFragmentDeclaration-YrWmXeNV.js";var _=`shadowOnlyVertexShader`,v=`attribute position: vec3f;
#ifdef NORMAL
attribute normal: vec3f;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<instancesDeclaration>
#include<sceneUboDeclaration>
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
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
var worldPos: vec4f=finalWorld* vec4f(vertexInputs.position,1.0);vertexOutputs.position=scene.viewProjection*worldPos;vertexOutputs.vPositionW= worldPos.xyz;
#ifdef NORMAL
vertexOutputs.vNormalW=normalize(( finalWorld* vec4f(vertexInputs.normal,0.0)).xyz);
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
#include<fogVertex>
#include<shadowsVertex>[0..maxSimultaneousLights]
#define CUSTOM_VERTEX_MAIN_END
}
`;e.ShadersStoreWGSL[_]||(e.ShadersStoreWGSL[_]=v);var y=[t,n,r,s,c,f,u,g,d,i,a,o,l,h,p,m];for(let t of y)e.IncludesShadersStoreWGSL[t.name]||(e.IncludesShadersStoreWGSL[t.name]=t.shader);var b={name:_,shader:v};export{b as shadowOnlyVertexShaderWGSL};