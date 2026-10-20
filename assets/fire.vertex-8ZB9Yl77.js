import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./bonesDeclaration-SX_sSZ8J.js";import{t as n}from"./bakedVertexAnimationDeclaration-C-g0vyVW.js";import{t as r}from"./instancesDeclaration-DsiFqYXH.js";import{t as i}from"./instancesVertex-Dty6qjVO.js";import{t as a}from"./bonesVertex-CDLHrzx0.js";import{t as o}from"./bakedVertexAnimation-CP3BNGXM.js";import{t as s}from"./clipPlaneVertexDeclaration-B8LM6QZj.js";import{t as c}from"./clipPlaneVertex-DfQm2Zia.js";import{t as l}from"./fogVertexDeclaration-CiHbVcSR.js";import{t as u}from"./logDepthDeclaration-BpsZdJ7z.js";import{t as d}from"./fogVertex-D0bmc4KF.js";import{t as f}from"./logDepthVertex-DSD5XdGw.js";import{t as p}from"./vertexColorMixing-UCrnwszu.js";var m=`fireVertexShader`,h=`attribute position: vec3f;
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
varying vDiffuseUV: vec2f;
#endif
#ifdef POINTSIZE
uniform pointSize: f32;
#endif
varying vPositionW: vec3f;
#ifdef VERTEXCOLOR
varying vColor: vec4f;
#endif
#include<clipPlaneVertexDeclaration>
#include<logDepthDeclaration>
#include<fogVertexDeclaration>
uniform time: f32;uniform speed: f32;
#ifdef DIFFUSE
varying vDistortionCoords1: vec2f;varying vDistortionCoords2: vec2f;varying vDistortionCoords3: vec2f;
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
#ifdef DIFFUSE
vertexOutputs.vDiffuseUV=vec2f(vertexInputs.uv.x,vertexInputs.uv.y-0.2);
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
#include<fogVertex>
#include<vertexColorMixing>
#ifdef DIFFUSE
var layerSpeed: vec3f= vec3f(-0.2,-0.52,-0.1)*uniforms.speed;vertexOutputs.vDistortionCoords1=vec2f(vertexInputs.uv.x,vertexInputs.uv.y+layerSpeed.x*uniforms.time/1000.0);vertexOutputs.vDistortionCoords2=vec2f(vertexInputs.uv.x,vertexInputs.uv.y+layerSpeed.y*uniforms.time/1000.0);vertexOutputs.vDistortionCoords3=vec2f(vertexInputs.uv.x,vertexInputs.uv.y+layerSpeed.z*uniforms.time/1000.0);
#endif
#define CUSTOM_VERTEX_MAIN_END
}
`;e.ShadersStoreWGSL[m]||(e.ShadersStoreWGSL[m]=h);var g=[t,n,r,s,u,l,i,a,o,c,f,d,p];for(let t of g)e.IncludesShadersStoreWGSL[t.name]||(e.IncludesShadersStoreWGSL[t.name]=t.shader);var _={name:m,shader:h};export{_ as fireVertexShaderWGSL};