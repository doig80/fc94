import{t as e}from"./shaderStore-D-XQlhUT.js";var t=`depthPrePass`,n=`#ifdef DEPTHPREPASS
gl_FragColor=vec4(0.,0.,0.,1.0);return;
#endif
`;e.IncludesShadersStore[t]||(e.IncludesShadersStore[t]=n);var r={name:t,shader:n};export{r as t};