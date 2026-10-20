import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./helperFunctions-DHdJUWHO.js";import{t as n}from"./sceneUboDeclaration-B96Tfx7b.js";import{t as r}from"./clipPlaneFragmentDeclaration-Dztv0IA8.js";import{t as i}from"./clipPlaneFragment-CWY7C38Z.js";import{t as a}from"./logDepthDeclaration-BpsZdJ7z.js";import{t as o}from"./lightUboDeclaration-invEuN9e.js";import{t as s}from"./lightsFragmentFunctions-DLwHFax8.js";import{t as c}from"./shadowsFragmentFunctions-CyvG9jhk.js";import{t as l}from"./fogFragmentDeclaration-B3hbo39x.js";import{t as u}from"./lightFragment-BkT__YJ5.js";import{t as d}from"./logDepthFragment-CxtJswLx.js";import{t as f}from"./fogFragment-C9E3EVJj.js";var p=`shadowOnlyPixelShader`,m=`#include<sceneUboDeclaration>
uniform alpha: f32;uniform shadowColor: vec3f;
#define ADDITIONAL_UBO_DECLARATION
varying vPositionW: vec3f;
#ifdef NORMAL
varying vNormalW: vec3f;
#endif
#include<helperFunctions>
#include<lightUboDeclaration>[0..maxSimultaneousLights]
#include<lightsFragmentFunctions>
#include<shadowsFragmentFunctions>
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
var viewDirectionW: vec3f=normalize(scene.vEyePosition.xyz-fragmentInputs.vPositionW);
#ifdef NORMAL
var normalW: vec3f=normalize(fragmentInputs.vNormalW);
#else
var normalW: vec3f= vec3f(1.0,1.0,1.0);
#endif
var diffuseBase: vec3f= vec3f(0.,0.,0.);var info: lightingInfo;var shadow: f32=1.;var glossiness: f32=0.;var aggShadow: f32=0.;var numLights: f32=0.;
#include<lightFragment>[0..1]
#define CUSTOM_FRAGMENT_BEFORE_LIGHT_COMPOSITION
var color: vec4f= vec4f(uniforms.shadowColor,(1.0-clamp(shadow,0.,1.))*uniforms.alpha);
#include<logDepthFragment>
#include<fogFragment>
fragmentOutputs.color=color;
#define CUSTOM_FRAGMENT_MAIN_END
}
`;e.ShadersStoreWGSL[p]||(e.ShadersStoreWGSL[p]=m);var h=[n,t,o,s,c,r,a,l,i,u,d,f];for(let t of h)e.IncludesShadersStoreWGSL[t.name]||(e.IncludesShadersStoreWGSL[t.name]=t.shader);var g={name:p,shader:m};export{g as shadowOnlyPixelShaderWGSL};