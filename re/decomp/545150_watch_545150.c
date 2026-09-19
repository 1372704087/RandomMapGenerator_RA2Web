// 0x545150 watch_545150 size=1C41

int __fastcall sub_545150(int a1, char a2)
{
  int v3; // ebp
  size_t v4; // eax
  size_t v5; // eax
  int i; // esi
  int v7; // eax
  void **v8; // esi
  int v9; // esi
  size_t v10; // eax
  size_t v11; // eax
  size_t v12; // eax
  size_t v13; // eax
  size_t v14; // eax
  size_t v15; // eax
  size_t v16; // eax
  size_t v17; // eax
  _BYTE *v18; // eax
  int j; // ecx
  int v20; // edi
  int v21; // ebx
  int v22; // eax
  int v23; // ecx
  int v24; // eax
  int v25; // eax
  int v26; // eax
  int v27; // eax
  int v28; // ebx
  _DWORD *v29; // eax
  int v30; // edx
  int v31; // eax
  int v32; // eax
  char v33; // al
  int v34; // ecx
  int v35; // eax
  int v36; // ebx
  int v37; // edx
  int v38; // ecx
  int v39; // ecx
  int v40; // edx
  int v41; // edx
  int v42; // eax
  int v43; // esi
  unsigned __int8 *v44; // ebx
  int v45; // edx
  int v46; // ecx
  int v47; // edx
  unsigned int *v48; // ecx
  unsigned int v49; // eax
  _DWORD *v50; // eax
  int v51; // ecx
  int v52; // edx
  int k; // edi
  _DWORD *v54; // eax
  int v55; // ecx
  int v56; // edx
  int v57; // edx
  char v59; // [esp+11h] [ebp-9FFh]
  char v61; // [esp+13h] [ebp-9FDh]
  char v62; // [esp+14h] [ebp-9FCh]
  char v63; // [esp+15h] [ebp-9FBh]
  char v64; // [esp+16h] [ebp-9FAh]
  char v65; // [esp+17h] [ebp-9F9h]
  int v66; // [esp+18h] [ebp-9F8h]
  char v67; // [esp+1Ch] [ebp-9F4h]
  bool v68; // [esp+1Dh] [ebp-9F3h]
  __int16 v69; // [esp+1Eh] [ebp-9F2h] BYREF
  int v70; // [esp+20h] [ebp-9F0h]
  int v71; // [esp+24h] [ebp-9ECh]
  int v72; // [esp+28h] [ebp-9E8h]
  int v73; // [esp+2Ch] [ebp-9E4h]
  int v74; // [esp+30h] [ebp-9E0h]
  _DWORD *v75; // [esp+34h] [ebp-9DCh]
  _DWORD v76[4]; // [esp+38h] [ebp-9D8h] BYREF
  char v77[12]; // [esp+48h] [ebp-9C8h] BYREF
  _BYTE v78[12]; // [esp+54h] [ebp-9BCh] BYREF
  int v79; // [esp+60h] [ebp-9B0h]
  int v80; // [esp+64h] [ebp-9ACh]
  int v81; // [esp+68h] [ebp-9A8h]
  char v82; // [esp+6Ch] [ebp-9A4h]
  int v83; // [esp+70h] [ebp-9A0h]
  int v84; // [esp+74h] [ebp-99Ch]
  char v85; // [esp+78h] [ebp-998h]
  int v86; // [esp+90h] [ebp-980h]
  int v87; // [esp+94h] [ebp-97Ch] BYREF
  int v88; // [esp+98h] [ebp-978h]
  int v89; // [esp+9Ch] [ebp-974h]
  int v90; // [esp+A0h] [ebp-970h]
  int v91; // [esp+A4h] [ebp-96Ch]
  int v92; // [esp+A8h] [ebp-968h]
  int v93; // [esp+ACh] [ebp-964h]
  int v94; // [esp+B0h] [ebp-960h]
  int v95; // [esp+B4h] [ebp-95Ch]
  int v96; // [esp+B8h] [ebp-958h]
  int v97; // [esp+BCh] [ebp-954h]
  int v98; // [esp+C0h] [ebp-950h]
  int v99; // [esp+C4h] [ebp-94Ch]
  int v100; // [esp+C8h] [ebp-948h]
  int v101; // [esp+CCh] [ebp-944h]
  int v102; // [esp+D0h] [ebp-940h]
  int v103; // [esp+D4h] [ebp-93Ch]
  int v104; // [esp+D8h] [ebp-938h]
  int v105; // [esp+DCh] [ebp-934h]
  int v106; // [esp+E0h] [ebp-930h]
  int v107; // [esp+E4h] [ebp-92Ch]
  int v108; // [esp+E8h] [ebp-928h]
  int v109; // [esp+ECh] [ebp-924h]
  int v110; // [esp+F0h] [ebp-920h]
  int v111; // [esp+F4h] [ebp-91Ch]
  int v112; // [esp+F8h] [ebp-918h]
  int v113; // [esp+FCh] [ebp-914h]
  int v114; // [esp+100h] [ebp-910h]
  int v115; // [esp+104h] [ebp-90Ch]
  int v116; // [esp+108h] [ebp-908h]
  int v117; // [esp+10Ch] [ebp-904h]
  int v118; // [esp+110h] [ebp-900h]
  int v119; // [esp+114h] [ebp-8FCh]
  int v120; // [esp+118h] [ebp-8F8h]
  int v121; // [esp+11Ch] [ebp-8F4h]
  int v122; // [esp+120h] [ebp-8F0h]
  int v123; // [esp+124h] [ebp-8ECh]
  int v124; // [esp+128h] [ebp-8E8h]
  int v125; // [esp+12Ch] [ebp-8E4h]
  int v126; // [esp+130h] [ebp-8E0h]
  int v127; // [esp+134h] [ebp-8DCh]
  int v128; // [esp+138h] [ebp-8D8h]
  int v129; // [esp+13Ch] [ebp-8D4h]
  int v130; // [esp+140h] [ebp-8D0h]
  int v131; // [esp+144h] [ebp-8CCh]
  int v132; // [esp+148h] [ebp-8C8h]
  int v133; // [esp+14Ch] [ebp-8C4h]
  int v134; // [esp+150h] [ebp-8C0h]
  int v135; // [esp+154h] [ebp-8BCh]
  int v136; // [esp+158h] [ebp-8B8h]
  int v137; // [esp+15Ch] [ebp-8B4h]
  int v138; // [esp+160h] [ebp-8B0h]
  int v139; // [esp+164h] [ebp-8ACh]
  int v140; // [esp+168h] [ebp-8A8h]
  int v141; // [esp+16Ch] [ebp-8A4h]
  int v142; // [esp+170h] [ebp-8A0h]
  int v143; // [esp+174h] [ebp-89Ch]
  int v144; // [esp+178h] [ebp-898h]
  _DWORD v145[2]; // [esp+17Ch] [ebp-894h] BYREF
  int v146; // [esp+184h] [ebp-88Ch]
  char v147[32]; // [esp+188h] [ebp-888h] BYREF
  char v148[12]; // [esp+1A8h] [ebp-868h] BYREF
  char v149[64]; // [esp+1B4h] [ebp-85Ch] BYREF
  char Buffer[5]; // [esp+1F4h] [ebp-81Ch] BYREF
  char v151; // [esp+1F9h] [ebp-817h]
  _DWORD v152[22]; // [esp+214h] [ebp-7FCh] BYREF
  char v153[12]; // [esp+26Ch] [ebp-7A4h] BYREF
  int v154; // [esp+278h] [ebp-798h]
  char v155[64]; // [esp+280h] [ebp-790h] BYREF
  char Destination[52]; // [esp+2C0h] [ebp-750h] BYREF
  char v157[52]; // [esp+2F4h] [ebp-71Ch] BYREF
  char v158[20]; // [esp+328h] [ebp-6E8h] BYREF
  _DWORD v159[22]; // [esp+33Ch] [ebp-6D4h] BYREF
  char v160[12]; // [esp+394h] [ebp-67Ch] BYREF
  int v161; // [esp+3A0h] [ebp-670h]
  void **v162; // [esp+3A8h] [ebp-668h] BYREF
  char v163[12]; // [esp+400h] [ebp-610h] BYREF
  int v164; // [esp+40Ch] [ebp-604h]
  char Filename[128]; // [esp+414h] [ebp-5FCh] BYREF
  void **v166; // [esp+494h] [ebp-57Ch] BYREF
  char v167[12]; // [esp+4ECh] [ebp-524h] BYREF
  int v168; // [esp+4F8h] [ebp-518h]
  _DWORD v169[22]; // [esp+500h] [ebp-510h] BYREF
  char v170[12]; // [esp+558h] [ebp-4B8h] BYREF
  int v171; // [esp+564h] [ebp-4ACh]
  void **v172; // [esp+56Ch] [ebp-4A4h] BYREF
  char v173[12]; // [esp+5C4h] [ebp-44Ch] BYREF
  int v174; // [esp+5D0h] [ebp-440h]
  void **v175; // [esp+5D8h] [ebp-438h] BYREF
  char v176[12]; // [esp+630h] [ebp-3E0h] BYREF
  int v177; // [esp+63Ch] [ebp-3D4h]
  void **v178; // [esp+644h] [ebp-3CCh] BYREF
  char v179[12]; // [esp+69Ch] [ebp-374h] BYREF
  int v180; // [esp+6A8h] [ebp-368h]
  char v181[32]; // [esp+6B0h] [ebp-360h] BYREF
  char Source[128]; // [esp+6D0h] [ebp-340h] BYREF
  char v183[512]; // [esp+750h] [ebp-2C0h] BYREF
  char v184[64]; // [esp+950h] [ebp-C0h] BYREF
  char v185[128]; // [esp+990h] [ebp-80h] BYREF

  v3 = 0;
  v95 = a1;
  v76[1] = 0;
  v76[2] = 0;
  sub_40E320(v77);
  sub_40E320(v78);
  sub_40E340(v78);
  v76[3] = &List<INIClass::INISection *>::`vftable';
  v79 = 0;
  v80 = 0;
  v81 = 0;
  v82 = 0;
  v83 = 0;
  v84 = 0;
  v85 = 0;
  v76[0] = &CCINIClass::`vftable';
  v86 = sub_6C8C40(&v87);
  dword_AA102C[0] = 0;
  dword_AA1030 = 0;
  v88 = 0;
  dword_AA1034 = 0;
  v93 = 0;
  dword_AA1038 = 0;
  dword_AA103C = 0;
  sub_4739F0(aCShadowShp);
  if ( lpBuffer != nullptr )
  {
    operator delete(lpBuffer);
    lpBuffer = nullptr;
  }
  v4 = sub_473C00(v159);
  lpBuffer = operator new(v4);
  v5 = sub_473C00(v159);
  sub_473B10(lpBuffer, v5);
  if ( dword_AA1088 != 0 )
  {
    for ( i = dword_AA1088 - 1; i >= 0; --i )
    {
      operator delete(*((void **)dword_AA107C + i));
      if ( i < dword_AA1088 )
      {
        v7 = i;
        if ( i < --dword_AA1088 )
        {
          do
          {
            ++v7;
            *((_DWORD *)dword_AA107C + v7 - 1) = *((_DWORD *)dword_AA107C + v7);
          }
          while ( v7 < dword_AA1088 );
        }
      }
    }
  }
  v8 = &dword_AA1060;
  do
  {
    if ( *v8 != nullptr )
    {
      operator delete(*v8);
      *v8 = nullptr;
    }
    ++v8;
  }
  while ( (int)v8 < (int)&dbl_AA1070 );
  v9 = 112 * a1;
  v117 = 112 * a1;
  sprintf(Buffer, "SLOP01Z.%s", (const char *)&off_7E1BC6 + 112 * a1);
  sub_4739F0(Buffer);
  v10 = sub_473C00(v152);
  dword_AA1060 = operator new(v10);
  v11 = sub_473C00(v152);
  sub_473B10(dword_AA1060, v11);
  v151 = 50;
  sub_473FC0(Buffer);
  v12 = sub_473C00(v152);
  dword_AA1064 = operator new(v12);
  v13 = sub_473C00(v152);
  sub_473B10(dword_AA1064, v13);
  v151 = 51;
  sub_473FC0(Buffer);
  v14 = sub_473C00(v152);
  dword_AA1068 = operator new(v14);
  v15 = sub_473C00(v152);
  sub_473B10(dword_AA1068, v15);
  v151 = 52;
  sub_473FC0(Buffer);
  v16 = sub_473C00(v152);
  dword_AA106C = operator new(v16);
  v17 = sub_473C00(v152);
  sub_473B10(dword_AA106C, v17);
  while ( dword_A8ED38 != 0 )
  {
    if ( *(_DWORD *)dword_A8ED2C != 0 )
      (*(void (__thiscall **)(_DWORD, int))(**(_DWORD **)dword_A8ED2C + 32))(*(_DWORD *)dword_A8ED2C, 1);
  }
  sprintf(v181, "ISO%s.PAL", (const char *)&off_7E1BC6 + v9);
  sub_4739F0(v181);
  if ( (unsigned __int8)sub_473C50(0) != 0 )
  {
    sub_473B10(&unk_ABBED0, 0x300u);
    v18 = &unk_ABBED0;
    for ( j = 768; j != 0; --j )
      *v18++ *= 4;
  }
  sub_545000();
  sprintf(v158, "%sMD.INI", &aTemperat[v9]);
  sub_4739F0(v158);
  sub_4741F0(v169, 0, 0);
  v20 = 0;
  v21 = 0;
  v94 = 0;
  v71 = 0;
  v73 = 0;
  v138 = sub_5276D0(aGeneral, aRampbase, -1);
  v142 = sub_5276D0(aGeneral, aRampsmooth, -1);
  v133 = sub_5276D0(aGeneral, aMmrampbase, -1);
  v98 = sub_5276D0(aGeneral, aCleartile, -1);
  v119 = sub_5276D0(aGeneral, aRoughtile, -1);
  v100 = sub_5276D0(aGeneral, aSandtile, -1);
  v120 = sub_5276D0(aGeneral, aGreentile, -1);
  v102 = sub_5276D0(aGeneral, aPavetile, -1);
  v122 = sub_5276D0(aGeneral, aMiscpavetile, -1);
  v104 = sub_5276D0(aGeneral, aCleartoroughla, -1);
  v124 = sub_5276D0(aGeneral, aCleartosandlat, -1);
  v106 = sub_5276D0(aGeneral, aCleartogreenla, -1);
  v126 = sub_5276D0(aGeneral, aCleartopavelat, -1);
  v108 = sub_5276D0(aGeneral, aHeightbase, -1);
  v128 = sub_5276D0(aGeneral, aBlacktile, -1);
  v110 = sub_5276D0(aGeneral, aBridgeset, -1);
  v130 = sub_5276D0(aGeneral, aWoodbridgeset, -1);
  v112 = sub_5276D0(aGeneral, aCliffset, -1);
  v132 = sub_5276D0(aGeneral, aShorepieces, -1);
  v114 = sub_5276D0(aGeneral, aWaterset, -1);
  v134 = sub_5276D0(aGeneral, aSlopesetpieces, -1);
  v116 = sub_5276D0(aGeneral, aSlopesetpieces_0, -1);
  v136 = sub_5276D0(aGeneral, aMonorailslopes, -1);
  v140 = sub_5276D0(aGeneral, aTunnels, -1);
  v121 = sub_5276D0(aGeneral, aTracktunnels, -1);
  v118 = sub_5276D0(aGeneral, aDirttunnels, -1);
  v96 = sub_5276D0(aGeneral, aDirttracktunne, -1);
  v143 = sub_5276D0(aGeneral, aWaterfalleast, -1);
  v123 = sub_5276D0(aGeneral, aWaterfallwest, -1);
  v135 = sub_5276D0(aGeneral, aWaterfallnorth, -1);
  v125 = sub_5276D0(aGeneral, aWaterfallsouth, -1);
  v141 = sub_5276D0(aGeneral, aClifframps, -1);
  v127 = sub_5276D0(aGeneral, aPavedroads, -1);
  v137 = sub_5276D0(aGeneral, aPavedroadends, -1);
  v129 = sub_5276D0(aGeneral, aMedians, -1);
  v146 = sub_5276D0(aGeneral, aRoughground, -1);
  v131 = sub_5276D0(aGeneral, aDirtroadjuncti, -1);
  v139 = sub_5276D0(aGeneral, aDirtroadcurve, -1);
  v97 = sub_5276D0(aGeneral, aDirtroadstraig, -1);
  v99 = sub_5276D0(aGeneral, aDestroyablecli, -2);
  v103 = sub_5276D0(aGeneral, aWatercaves, -1);
  v101 = sub_5276D0(aGeneral, aWatercliffs, -1);
  v105 = sub_5276D0(aGeneral, aPavedroadslope, -1);
  v107 = sub_5276D0(aGeneral, aDirtroadslopes, -1);
  v109 = sub_5276D0(aGeneral, aRocks, -1);
  v22 = sub_5276D0(aGeneral, aWaterbridge, -1);
  dword_ABC1D8 = -1;
  dword_AA1058 = -1;
  v111 = v22;
  dword_AA109C = -1;
  dword_AA10B0 = -1;
  dword_ABC2B8 = -1;
  dword_ABB104 = -1;
  dword_AA0E18 = -1;
  dword_ABC2B0 = -1;
  dword_AA10A4 = -1;
  dword_AA1134 = -1;
  dword_AA0E24 = -1;
  dword_AA0748 = -1;
  dword_AA10A8 = -1;
  dword_AA0744 = -1;
  dword_ABC2CC = -1;
  dword_AA0E28 = -1;
  dword_ABAD1C = -1;
  dword_AA1020 = -1;
  dword_ABAD28 = -1;
  dword_AA0738 = -1;
  dword_ABC1F8 = -1;
  dword_AA1098 = -1;
  dword_AA1024 = -1;
  dword_AA1054 = -1;
  dword_ABB108 = -1;
  dword_AA10B4 = -1;
  dword_ABAD2C = -1;
  dword_AA073C = -1;
  dword_ABB110 = -1;
  dword_AA10A0 = -1;
  dword_AA1050 = -1;
  dword_ABBEBC = -1;
  dword_ABBEC8 = -1;
  dword_ABBEC4 = -1;
  dword_AA0E20 = -1;
  dword_AA0E1C = -1;
  dword_ABAD20 = -1;
  dword_ABC1D4 = -1;
  dword_AA10AC = -1;
  dword_ABC2C8 = -2;
  dword_ABAD24 = -1;
  dword_AA101C = -1;
  dword_AA1094 = -1;
  dword_ABBEC0 = -1;
  dword_ABB10C = -1;
  dword_AA1090 = -1;
  dword_ABC2B4 = sub_5276D0(aGeneral, aBridgetopleft1, -1);
  dword_AA1130 = sub_5276D0(aGeneral, aBridgetopleft2, -1);
  dword_ABC1E8 = sub_5276D0(aGeneral, aBridgebottomri, -1);
  dword_AA0E38 = sub_5276D0(aGeneral, aBridgebottomri_0, -1);
  dword_AA1548 = sub_5276D0(aGeneral, aBridgetopright, -1);
  dword_AA0740 = sub_5276D0(aGeneral, aBridgetopright_0, -1);
  dword_ABC1D0 = sub_5276D0(aGeneral, aBridgebottomle, -1);
  dword_AA1540 = sub_5276D0(aGeneral, aBridgebottomle_0, -1);
  dword_ABAD30 = sub_5276D0(aGeneral, aBridgemiddle1, -1);
  dword_AA1028 = sub_5276D0(aGeneral, aBridgemiddle2, -1);
  dword_ABC558 = 0;
  v86 = sub_6C8C40(v145);
  v23 = 4;
  v87 = v145[0];
  v88 = 4;
  while ( 1 )
  {
    v70 = v23;
    if ( v86 == -1 )
      goto LABEL_24;
    v24 = sub_6C8C40(&v87);
    v25 = v24 - v86;
    if ( v25 < v70 )
    {
      v23 = v70 - v25;
LABEL_24:
      if ( v23 != 0 )
        goto LABEL_26;
    }
    sub_48D080();
    v144 = sub_6C8C40(v145);
    v145[1] = 4;
    v86 = v144;
    v87 = v145[0];
    v88 = 4;
LABEL_26:
    v26 = dword_ABC558;
    dword_AA1140[dword_ABC558] = v21;
    dword_ABC558 = v26 + 1;
    if ( v20 == v138 )
      dword_ABC1D8 = v21;
    if ( v20 == v142 )
      dword_AA1058 = v21;
    if ( v20 == v133 )
      dword_AA109C = v21;
    if ( v20 == v98 )
      dword_AA10B0 = v21;
    if ( v20 == v119 )
      dword_ABC2B8 = v21;
    if ( v20 == v100 )
      dword_ABB104 = v21;
    if ( v20 == v120 )
      dword_AA0E18 = v21;
    if ( v20 == v102 )
      dword_ABC2B0 = v21;
    if ( v20 == v122 )
      dword_AA10A4 = v21;
    if ( v20 == v104 )
      dword_AA1134 = v21;
    if ( v20 == v124 )
      dword_AA0E24 = v21;
    if ( v20 == v106 )
      dword_AA0748 = v21;
    if ( v20 == v126 )
      dword_AA10A8 = v21;
    if ( v20 == v108 )
      dword_AA0744 = v21;
    if ( v20 == v128 )
      dword_ABC2CC = v21;
    if ( v20 == v110 )
      dword_AA0E28 = v21;
    if ( v20 == v130 )
      dword_ABAD1C = v21;
    if ( v20 == v112 )
      dword_AA1020 = v21;
    if ( v20 == v132 )
      dword_ABAD28 = v21;
    if ( v20 == v114 )
      dword_AA0738 = v21;
    if ( v20 == v134 )
      dword_ABC1F8 = v21;
    if ( v20 == v116 )
      dword_AA1098 = v21;
    if ( v20 == v136 )
      dword_AA1024 = v21;
    if ( v20 == v118 )
      dword_AA10B4 = v21;
    if ( v20 == v96 )
      dword_ABAD2C = v21;
    if ( v20 == v140 )
      dword_AA1054 = v21;
    if ( v20 == v121 )
      dword_ABB108 = v21;
    if ( v20 == v143 )
      dword_AA073C = v21;
    if ( v20 == v123 )
      dword_ABB110 = v21;
    if ( v20 == v135 )
      dword_AA10A0 = v21;
    if ( v20 == v125 )
      dword_AA1050 = v21;
    if ( v20 == v141 )
      dword_ABBEBC = v21;
    if ( v20 == v127 )
      dword_ABBEC8 = v21;
    if ( v20 == v137 )
      dword_ABBEC4 = v21;
    if ( v20 == v129 )
      dword_AA0E20 = v21;
    if ( v20 == v146 )
      dword_AA0E1C = v21;
    if ( v20 == v131 )
      dword_ABAD20 = v21;
    if ( v20 == v139 )
      dword_ABC1D4 = v21;
    if ( v20 == v97 )
      dword_AA10AC = v21;
    if ( v20 == v99 )
      dword_ABC2C8 = v21;
    if ( v20 == v101 )
      dword_AA101C = v21;
    if ( v20 == v103 )
      dword_ABAD24 = v21;
    if ( v20 == v105 )
      dword_AA1094 = v21;
    if ( v20 == v107 )
      dword_ABBEC0 = v21;
    if ( v20 == v109 )
      dword_ABB10C = v21;
    if ( v20 == v111 )
      dword_AA1090 = v21;
    sprintf(v149, "TileSet%04d", v20);
    sub_526B00(v76);
    v72 = sub_5276D0(v149, aTilesinset, -1);
    if ( v72 == -1 )
      break;
    v27 = sub_5276D0(v149, aLasttilesinset, -1);
    v28 = v27;
    if ( v27 == -1 || v27 == v72 )
    {
      v32 = v72 + v73;
    }
    else
    {
      v29 = operator new(8u);
      v30 = v72 - v28;
      v75 = v29;
      v74 = v28 + v73;
      *v29 = v28 + v73;
      v29[1] = v30;
      if ( dword_AA1088 < dword_AA1080
        || (byte_AA1085 != 0 || dword_AA1080 == 0)
        && dword_AA108C > 0
        && (*(unsigned __int8 (__thiscall **)(int *, int, _DWORD))(dword_AA1078 + 8))(
             &dword_AA1078,
             dword_AA108C + dword_AA1080,
             0) != 0 )
      {
        v31 = dword_AA1088++;
        *((_DWORD *)dword_AA107C + v31) = v75;
      }
      v32 = v74;
    }
    v73 = v32;
    sub_528A10((int)v149, (int)aSetname, aNoName, v155, 0x40u);
    sub_528A10((int)v149, (int)aFilename, aTile, v184, 0x40u);
    v74 = sub_5276D0(v149, aMarblemadness, 0xFFFF);
    v90 = sub_5276D0(v149, aNonmarblemadne, 0xFFFF);
    v67 = sub_5295F0(v149, aMorphable, 0);
    v63 = sub_5295F0(v149, aAllowtoplace, 1);
    v65 = sub_5295F0(v149, aAllowburrowing, 1);
    v61 = sub_5295F0(v149, aAllowtiberium, 0);
    v64 = sub_5295F0(v149, aRequiredforrmg, 0);
    v113 = sub_5276D0(v149, aTosnowtheater, -1);
    v115 = sub_5276D0(v149, aTotemperatethe, -1);
    v33 = sub_5295F0(v149, aShadowcaster, 0);
    v62 = v33;
    if ( v33 != 0 )
    {
      v34 = v93;
      dword_AA102C[v93] = v71;
      v93 = v34 + 1;
    }
    v92 = 0;
    if ( v33 != 0 )
      v92 = sub_5276D0(v149, aShadowtiles, 0);
    v35 = sub_526810(v155);
    v70 = 0;
    v68 = v35 != 0;
    if ( v72 > 0 )
    {
      while ( 1 )
      {
        v66 = 0;
        v75 = nullptr;
        v89 = 0;
        v91 = v71 - 1;
        do
        {
          if ( v66 != 0 )
            v69 = (unsigned __int8)(v66 + 96);
          else
            LOBYTE(v69) = 0;
          v36 = v70 + 1;
          sprintf(v148, "%02d", v70 + 1);
          strcat(v148, (const char *)&v69);
          strcpy(Filename, v184);
          strcat(Filename, v148);
          sprintf(Source, "%.28s %02d", v155, v36);
          if ( v66 == 0 )
          {
            if ( operator new(0x30Cu) != nullptr )
            {
              v37 = v71++;
              ++v91;
              v3 = sub_5447C0(v37, -65, 0, Filename, 0);
            }
            else
            {
              v3 = 0;
            }
            if ( Source != nullptr )
            {
              strncpy(Destination, Source, 0x30u);
              Destination[48] = 0;
            }
            else
            {
              Destination[0] = (unsigned __int8)Source;
            }
            if ( Destination != (char *)(v3 + 100) )
              qmemcpy((void *)(v3 + 100), Destination, 49);
            v38 = v90;
            *(_DWORD *)(v3 + 664) = v74;
            *(_DWORD *)(v3 + 668) = v38;
            *(_BYTE *)(v3 + 738) = v63;
            *(_BYTE *)(v3 + 736) = v67;
            *(_BYTE *)(v3 + 739) = v64;
            *(_BYTE *)(v3 + 773) = v65;
            v39 = v113;
            *(_BYTE *)(v3 + 774) = v61;
            v40 = v115;
            *(_DWORD *)(v3 + 164) = 0;
            *(_BYTE *)(v3 + 168) = 0;
            *(_DWORD *)(v3 + 704) = v39;
            *(_DWORD *)(v3 + 708) = v40;
            if ( v62 != 0 && v92 != 0 )
              *(_BYTE *)(v3 + 737) = v62;
            if ( a2 != 0 )
              *(_BYTE *)(v3 + 756) = 1;
            v41 = *(_DWORD *)(v3 + 676);
            *(_DWORD *)(v3 + 672) = dword_AA113C[dword_ABC558];
            (*(void (__thiscall **)(int))(v41 + 12))(v3 + 676);
            if ( v68 )
            {
              sprintf(v147, "Tile%02dAnim", v36);
              if ( sub_528A10((int)v155, (int)v147, &byte_889F64, v185, 0x80u) != 0 )
              {
                v42 = sub_428B80(v185);
                if ( v42 != 0 )
                {
                  *(_DWORD *)(v3 + 712) = (*(int (__thiscall **)(int))(*(_DWORD *)v42 + 64))(v42);
                  sprintf(v147, "Tile%02dXOffset", v36);
                  *(_DWORD *)(v3 + 716) = sub_5276D0(v155, v147, *(_DWORD *)(v3 + 716));
                  sprintf(v147, "Tile%02dYOffset", v36);
                  *(_DWORD *)(v3 + 720) = sub_5276D0(v155, v147, *(_DWORD *)(v3 + 720));
                  sprintf(v147, "Tile%02dAttachesTo", v36);
                  *(_DWORD *)(v3 + 724) = sub_5276D0(v155, v147, *(_DWORD *)(v3 + 724));
                  sprintf(v147, "Tile%02dZAdjust", v36);
                  *(_DWORD *)(v3 + 728) = sub_5276D0(v155, v147, *(_DWORD *)(v3 + 728));
                }
              }
            }
            v75 = (_DWORD *)v3;
            v89 = v3;
          }
          v43 = v117;
          _makepath(v183, nullptr, nullptr, Filename, (const char *)&off_7E1BC6 + v117);
          v44 = nullptr;
          v59 = 0;
          if ( a2 != 0 )
          {
            sub_4739F0(v183);
            v59 = sub_473C50(0);
            if ( v59 != 0 && v66 == 0 )
              strncpy((char *)(v3 + 757), v183, 0xEu);
            v172 = &CCFileClass::`vftable';
            v174 = 0;
            sub_43AE50(v173);
            v172 = (void **)&off_7E1668;
            sub_431B80(&v172);
            if ( v59 != 0 )
              goto LABEL_190;
          }
          else
          {
            v44 = (unsigned __int8 *)sub_5B40B0(v183);
            if ( v44 != nullptr )
              goto LABEL_189;
          }
          if ( v90 == 0 )
            goto LABEL_190;
          if ( v95 == -1 )
            _makepath(v183, nullptr, nullptr, Filename, aMmt);
          else
            _makepath(v183, nullptr, nullptr, Filename, (const char *)&off_7E1BCA + v43);
          if ( a2 != 0 )
          {
            sub_4739F0(v183);
            v59 = sub_473C50(0);
            if ( v59 != 0 && v66 == 0 )
              strncpy((char *)(v3 + 757), v183, 0xEu);
            v175 = &CCFileClass::`vftable';
            v177 = 0;
            sub_43AE50(v176);
            v175 = (void **)&off_7E1668;
            sub_431B80(&v175);
            if ( v59 != 0 )
              goto LABEL_190;
          }
          else
          {
            v44 = (unsigned __int8 *)sub_5B40B0(v183);
            if ( v44 != nullptr )
              goto LABEL_189;
          }
          _makepath(v183, nullptr, nullptr, Filename, aTem);
          if ( a2 != 0 )
          {
            sub_4739F0(v183);
            v59 = sub_473C50(0);
            if ( v59 != 0 && v66 == 0 )
              strncpy((char *)(v3 + 757), v183, 0xEu);
            v166 = &CCFileClass::`vftable';
            v168 = 0;
            sub_43AE50(v167);
            v166 = (void **)&off_7E1668;
            sub_431B80(&v166);
            if ( v59 != 0 )
              goto LABEL_190;
          }
          else
          {
            v44 = (unsigned __int8 *)sub_5B40B0(v183);
            if ( v44 != nullptr )
              goto LABEL_189;
          }
          _makepath(v183, nullptr, nullptr, Filename, aUrb);
          if ( a2 == 0 )
          {
            v44 = (unsigned __int8 *)sub_5B40B0(v183);
            if ( v44 == nullptr )
              goto LABEL_190;
LABEL_189:
            v59 = 1;
            goto LABEL_190;
          }
          sub_4739F0(v183);
          v59 = sub_473C50(0);
          if ( v59 != 0 && v66 == 0 )
            strncpy((char *)(v3 + 757), v183, 0xEu);
          v178 = &CCFileClass::`vftable';
          v180 = 0;
          sub_43AE50(v179);
          v178 = (void **)&off_7E1668;
          sub_431B80(&v178);
LABEL_190:
          if ( v66 == 0 )
            goto LABEL_207;
          if ( v44 == nullptr && v59 == 0 )
            break;
          if ( operator new(0x30Cu) != nullptr )
            v3 = sub_5447C0(v91, -65, 0, Filename, 1);
          else
            v3 = 0;
          if ( Source != nullptr )
          {
            strncpy(v157, Source, 0x30u);
            v157[48] = 0;
          }
          else
          {
            v157[0] = (unsigned __int8)Source;
          }
          if ( v157 != (char *)(v3 + 100) )
            qmemcpy((void *)(v3 + 100), v157, 49);
          v45 = v74;
          *(_DWORD *)(v3 + 668) = v90;
          *(_DWORD *)(v3 + 664) = v45;
          *(_BYTE *)(v3 + 773) = v65;
          *(_BYTE *)(v3 + 736) = v67;
          *(_BYTE *)(v3 + 738) = v63;
          *(_BYTE *)(v3 + 774) = v61;
          *(_BYTE *)(v3 + 739) = v64;
          if ( a2 != 0 )
          {
            *(_BYTE *)(v3 + 756) = 1;
            strncpy((char *)(v3 + 757), v183, 0xEu);
          }
          if ( v62 != 0 && v92 != 0 )
            *(_BYTE *)(v3 + 737) = v62;
          v46 = v89;
          *(_DWORD *)(v3 + 672) = dword_AA113C[dword_ABC558];
          *(_DWORD *)(v46 + 700) = v3;
          (*(void (__thiscall **)(int))(*(_DWORD *)(v3 + 676) + 12))(v3 + 676);
          v89 = v3;
          if ( v44 == nullptr )
          {
LABEL_215:
            if ( v66 == 0 )
            {
              *(_DWORD *)(v3 + 740) = 0;
              *(_DWORD *)(v3 + 744) = 0;
            }
            goto LABEL_217;
          }
LABEL_207:
          *(_DWORD *)(v3 + 164) = v44;
          if ( v44 == nullptr )
            goto LABEL_215;
          v47 = 0;
          *(_DWORD *)(v3 + 740) = *v44;
          *(_DWORD *)(v3 + 744) = v44[4];
          if ( *((_DWORD *)v44 + 1) * *(_DWORD *)v44 > 0 )
          {
            v48 = (unsigned int *)(v44 + 16);
            do
            {
              v49 = *v48;
              if ( *v48 != 0 && v49 < (unsigned int)v44 )
                *v48 = (unsigned int)&v44[v49];
              ++v47;
              ++v48;
            }
            while ( v47 < *((_DWORD *)v44 + 1) * *(_DWORD *)v44 );
          }
          sub_549E90(v3);
LABEL_217:
          ++v66;
        }
        while ( v44 != nullptr || v59 != 0 );
        if ( v66 > 1 )
        {
          v50 = v75;
          if ( (char)v66 > 1 )
          {
            v51 = (char)v66;
            v52 = (char)v66 - 1;
            do
            {
              v50[188] = v51;
              v50 = (_DWORD *)v50[175];
              --v51;
              --v52;
            }
            while ( v52 != 0 );
          }
        }
        if ( ++v70 >= v72 )
        {
          v20 = v94;
          break;
        }
      }
    }
    v23 = v88;
    v21 = v71;
    v94 = ++v20;
  }
  for ( k = 0; k < dword_A8ED38; ++k )
  {
    v54 = *((_DWORD **)dword_A8ED2C + k);
    v55 = v54[165] - v54[168];
    v56 = v54[166];
    if ( v56 != 0xFFFF )
      v54[166] = v55 + dword_AA1140[v56];
    v57 = v54[167];
    if ( v57 != 0xFFFF )
      v54[167] = v55 + dword_AA1140[v57];
  }
  if ( v95 == 5 )
  {
    dword_ABAD28 = -1;
    dword_AA0738 = -1;
    dword_AA1020 = -1;
    dword_AA101C = -1;
    dword_AA1090 = -1;
    dword_AA0E28 = -1;
    dword_ABAD1C = -1;
  }
  v169[0] = &CCFileClass::`vftable';
  v171 = 0;
  sub_43AE50(v170);
  v169[0] = &off_7E1668;
  sub_431B80(v169);
  v162 = &CCFileClass::`vftable';
  v164 = 0;
  sub_43AE50(v163);
  v162 = (void **)&off_7E1668;
  sub_431B80(&v162);
  v152[0] = &CCFileClass::`vftable';
  v154 = 0;
  sub_43AE50(v153);
  v152[0] = &off_7E1668;
  sub_431B80(v152);
  v159[0] = &CCFileClass::`vftable';
  v161 = 0;
  sub_43AE50(v160);
  v159[0] = &off_7E1668;
  sub_431B80(v159);
  return sub_5256F0(v76);
}
