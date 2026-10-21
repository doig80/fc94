import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./helperFunctions-D8vur8CW.js";import{t as n}from"./clipPlaneFragmentDeclaration-M3T9Lap-.js";import{t as r}from"./clipPlaneFragment-CXLYb7ZJ.js";import{t as i}from"./sceneUboDeclaration-B5VhSG0v.js";import{t as a}from"./logDepthDeclaration-Dh136csG.js";import{t as o}from"./lightFragmentDeclaration-BfzJFvAK.js";import{t as s}from"./lightUboDeclaration-0GW0xpMZ.js";import{t as c}from"./lightsFragmentFunctions-CrErKaBy.js";import{t as l}from"./shadowsFragmentFunctions-BBZeOHdF.js";import{t as u}from"./fogFragmentDeclaration--w8QPs2M.js";import{t as d}from"./lightFragment-CbTUC3ac.js";import{t as f}from"./logDepthFragment-C5lxT4l1.js";import{t as p}from"./fogFragment-CKCGTcJi.js";import{t as m}from"./sceneFragmentDeclaration-ql3RpL9u.js";import{t as h}from"./imageProcessingCompatibility-D6_4f0FX.js";var g=`shadowOnlyPixelShader`,_=`precision highp float;
#include<__decl__sceneFragment>
uniform float alpha;uniform vec3 shadowColor;
#define ADDITIONAL_FRAGMENT_DECLARATION
varying vec3 vPositionW;
#ifdef NORMAL
varying vec3 vNormalW;
#endif
#include<helperFunctions>
#include<__decl__lightFragment>[0..maxSimultaneousLights]
#include<lightsFragmentFunctions>
#include<shadowsFragmentFunctions>
#include<clipPlaneFragmentDeclaration>
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
#if defined(CLUSTLIGHT_BATCH) && CLUSTLIGHT_BATCH>0
varying float vViewDepth;
#endif
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
vec3 viewDirectionW=normalize(vEyePosition.xyz-vPositionW);
#ifdef NORMAL
vec3 normalW=normalize(vNormalW);
#else
vec3 normalW=vec3(1.0,1.0,1.0);
#endif
vec3 diffuseBase=vec3(0.,0.,0.);lightingInfo info;float shadow=1.;float glossiness=0.;float aggShadow=0.;float numLights=0.;
#include<lightFragment>[0..1]
#define CUSTOM_FRAGMENT_BEFORE_LIGHT_COMPOSITION
vec4 color=vec4(shadowColor,(1.0-clamp(shadow,0.,1.))*alpha);
#include<logDepthFragment>
#include<fogFragment>
gl_FragColor=color;
#include<imageProcessingCompatibility>
#define CUSTOM_FRAGMENT_MAIN_END
}`;e.ShadersStore[g]||(e.ShadersStore[g]=_);var v=[m,i,t,o,s,c,l,n,a,u,r,d,f,p,h];for(let t of v)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var y={name:g,shader:_};export{y as shadowOnlyPixelShader};