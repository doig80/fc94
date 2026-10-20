import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./helperFunctions-DHdJUWHO.js";import{t as n}from"./clipPlaneFragmentDeclaration-Dztv0IA8.js";import{t as r}from"./clipPlaneFragment-CWY7C38Z.js";import{t as i}from"./logDepthDeclaration-BpsZdJ7z.js";import{t as a}from"./lightUboDeclaration-invEuN9e.js";import{t as o}from"./lightsFragmentFunctions-DLwHFax8.js";import{t as s}from"./shadowsFragmentFunctions-CyvG9jhk.js";import{t as c}from"./fogFragmentDeclaration-B3hbo39x.js";import{t as l}from"./lightFragment-BkT__YJ5.js";import{t as u}from"./logDepthFragment-CxtJswLx.js";import{t as d}from"./fogFragment-C9E3EVJj.js";import{t as f}from"./depthPrePass-CQ3IMX5D.js";import{t as p}from"./imageProcessingCompatibility-BrJjq0Gl.js";var m=`normalPixelShader`,h=`uniform vEyePosition: vec4f;uniform vDiffuseColor: vec4f;varying vPositionW: vec3f;
#ifdef NORMAL
varying vNormalW: vec3f;
#endif
#ifdef LIGHTING
#include<helperFunctions>
#include<lightUboDeclaration>[0]
#include<lightUboDeclaration>[1]
#include<lightUboDeclaration>[2]
#include<lightUboDeclaration>[3]
#include<lightsFragmentFunctions>
#include<shadowsFragmentFunctions>
#endif
#ifdef DIFFUSE
varying vDiffuseUV: vec2f;var diffuseSamplerSampler: sampler;var diffuseSampler: texture_2d<f32>;uniform vDiffuseInfos: vec2f;
#endif
#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
#if defined(CLUSTLIGHT_BATCH) && CLUSTLIGHT_BATCH>0
varying vViewDepth: f32;
#endif
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
var viewDirectionW: vec3f=normalize(uniforms.vEyePosition.xyz-fragmentInputs.vPositionW);var baseColor: vec4f= vec4f(1.,1.,1.,1.);var diffuseColor: vec3f=uniforms.vDiffuseColor.rgb;var alpha: f32=uniforms.vDiffuseColor.a;
#ifdef DIFFUSE
baseColor=textureSample(diffuseSampler,diffuseSamplerSampler,fragmentInputs.vDiffuseUV);
#ifdef ALPHATEST
if (baseColor.a<0.4) {discard;}
#endif
#define DEPTHPREPASS_SKIP_EARLY_RETURN
#include<depthPrePass>
#ifndef DEPTHPREPASS
baseColor=vec4f(baseColor.rgb*uniforms.vDiffuseInfos.y,baseColor.a);
#endif
#endif
#ifndef DEPTHPREPASS
#ifdef NORMAL
baseColor=mix(baseColor, vec4f(fragmentInputs.vNormalW,1.0),0.5);
#endif
#ifdef NORMAL
var normalW: vec3f=normalize(fragmentInputs.vNormalW);
#else
var normalW: vec3f= vec3f(1.0,1.0,1.0);
#endif
#ifdef LIGHTING
var diffuseBase: vec3f= vec3f(0.,0.,0.);var info: lightingInfo;var shadow: f32=1.;var glossiness: f32=0.;var aggShadow: f32=0.;var numLights: f32=0.;
#include<lightFragment>[0]
#include<lightFragment>[1]
#include<lightFragment>[2]
#include<lightFragment>[3]
var finalDiffuse: vec3f=clamp(diffuseBase*diffuseColor,vec3f(0.0),vec3f(1.0))*baseColor.rgb;
#else
var finalDiffuse: vec3f= baseColor.rgb;
#endif
var color: vec4f= vec4f(finalDiffuse,alpha);
#include<logDepthFragment>
#include<fogFragment>
fragmentOutputs.color=color;
#include<imageProcessingCompatibility>
#define CUSTOM_FRAGMENT_MAIN_END
#endif
}
`;e.ShadersStoreWGSL[m]||(e.ShadersStoreWGSL[m]=h);var g=[t,a,o,s,n,i,c,r,f,l,u,d,p];for(let t of g)e.IncludesShadersStoreWGSL[t.name]||(e.IncludesShadersStoreWGSL[t.name]=t.shader);var _={name:m,shader:h};export{_ as normalPixelShaderWGSL};