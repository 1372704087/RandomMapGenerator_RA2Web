// 0x58d620 Region_Split size=FAC

char __thiscall sub_58D620(int this)
{
  char v2; // al
  int v4; // esi
  void *v5; // eax
  int *v6; // eax
  int *v7; // esi
  int v8; // edx
  int v9; // eax
  void *v10; // eax
  int v11; // ecx
  int v12; // eax
  int i; // eax
  int v14; // eax
  int v15; // ecx
  int v16; // ecx
  int j; // ecx
  int v18; // eax
  unsigned int v19; // edi
  int v20; // eax
  double v21; // st7
  unsigned int v22; // edi
  unsigned int v23; // eax
  int v24; // ecx
  void *v25; // edi
  unsigned int v26; // ecx
  unsigned int v27; // edx
  int v28; // ebx
  int v29; // ebp
  unsigned int v30; // eax
  __int16 *v31; // edi
  int v32; // eax
  __int16 *v33; // ecx
  float *v34; // ebp
  int v35; // edx
  char *v36; // eax
  _DWORD *v37; // eax
  unsigned int v38; // ecx
  unsigned int v39; // edx
  double v40; // st7
  float v41; // edx
  int v42; // eax
  int v43; // eax
  float *v44; // edi
  int v45; // edx
  int v46; // eax
  unsigned int v47; // ecx
  unsigned int v48; // edx
  int v49; // ebx
  unsigned int v50; // eax
  bool v51; // cc
  long double v52; // st7
  int v53; // ecx
  bool v54; // zf
  int v55; // eax
  __int16 *v56; // edi
  int v57; // ecx
  int v58; // eax
  _DWORD *v59; // edi
  int v60; // eax
  int v61; // eax
  _DWORD *v62; // ebx
  int v63; // edx
  char *v64; // ecx
  int v65; // ebp
  int v66; // esi
  int v67; // ebx
  int v68; // ecx
  int v69; // eax
  int v70; // edi
  int v71; // eax
  int v72; // eax
  int v73; // edx
  int v74; // eax
  int v75; // eax
  int v76; // edx
  int k; // eax
  int v78; // ecx
  int v79; // eax
  char v80; // al
  int v81; // ebx
  int v82; // edx
  char *v83; // esi
  int v84; // ecx
  int v85; // eax
  int v86; // eax
  int v87; // edx
  _DWORD *v88; // eax
  int v89; // eax
  __int16 *v90; // eax
  _BYTE *v91; // eax
  int v92; // ebx
  void *v93; // ecx
  signed int v94; // eax
  int v95; // eax
  int v96; // edi
  int v97; // edx
  int v98; // eax
  int v99; // ebx
  signed int v100; // edx
  int v101; // esi
  int v102; // edi
  int v103; // eax
  char *v104; // ecx
  int v105; // eax
  int v106; // eax
  int v107; // eax
  int v108; // esi
  int v109; // eax
  int v110; // eax
  int v111; // eax
  int v112; // eax
  int v113; // esi
  int v114; // eax
  int v115; // eax
  int v116; // esi
  int v117; // edx
  int v118; // ecx
  int v119; // eax
  int v120; // edi
  unsigned int v121; // esi
  unsigned int v122; // eax
  int v123; // eax
  char v124; // bl
  int v125; // esi
  _DWORD *v126; // edi
  _DWORD *v127; // ebp
  int v128; // eax
  char v129; // bl
  int kk; // esi
  int mm; // ebx
  int v132; // eax
  int v133; // ecx
  int v134; // edi
  int v135; // ecx
  int v136; // eax
  int v137; // edx
  int v138; // edi
  _DWORD *v139; // ecx
  int v140; // eax
  void *v141; // esi
  void *v142; // eax
  char v143; // [esp+34h] [ebp-A0h]
  int m; // [esp+34h] [ebp-A0h]
  int ii; // [esp+34h] [ebp-A0h]
  int v146; // [esp+34h] [ebp-A0h]
  void **v147; // [esp+38h] [ebp-9Ch] BYREF
  int v148; // [esp+3Ch] [ebp-98h]
  int v149; // [esp+40h] [ebp-94h]
  char v150; // [esp+45h] [ebp-8Fh]
  int jj; // [esp+48h] [ebp-8Ch]
  int v152; // [esp+4Ch] [ebp-88h]
  __int16 *v153; // [esp+50h] [ebp-84h]
  long double v154; // [esp+54h] [ebp-80h]
  void *Block; // [esp+60h] [ebp-74h]
  void *n; // [esp+64h] [ebp-70h]
  float v157; // [esp+68h] [ebp-6Ch]
  double v158; // [esp+6Ch] [ebp-68h] BYREF
  _DWORD *v159; // [esp+74h] [ebp-60h]
  int v160; // [esp+78h] [ebp-5Ch]
  double v161; // [esp+7Ch] [ebp-58h]
  int v162; // [esp+84h] [ebp-50h] BYREF
  int v163; // [esp+88h] [ebp-4Ch] BYREF
  double v164; // [esp+8Ch] [ebp-48h] BYREF
  __int64 v165; // [esp+98h] [ebp-3Ch]
  void **v166; // [esp+A0h] [ebp-34h] BYREF
  void *v167; // [esp+A4h] [ebp-30h]
  int v168; // [esp+A8h] [ebp-2Ch]
  int v169; // [esp+ACh] [ebp-28h]
  int v170; // [esp+B0h] [ebp-24h]
  int v171; // [esp+B4h] [ebp-20h]
  int v172; // [esp+B8h] [ebp-1Ch]
  void **v173; // [esp+BCh] [ebp-18h]
  void *v174; // [esp+C0h] [ebp-14h]
  char v175; // [esp+C9h] [ebp-Bh]
  int v176; // [esp+CCh] [ebp-8h]
  int v177; // [esp+D0h] [ebp-4h]

  v2 = *(_BYTE *)(this + 26);
  v159 = (_DWORD *)this;
  if ( v2 != 0 )
    return 0;
  v4 = 2 * *(_DWORD *)(this + 12) + 10;
  v5 = operator new(8 * v4);
  if ( v5 != nullptr )
  {
    Block = v5;
    LODWORD(v161) = v4 - 1;
  }
  else
  {
    Block = nullptr;
  }
  v6 = (int *)operator new(0x14u);
  v7 = v6;
  if ( v6 != nullptr )
  {
    v8 = *(_DWORD *)(this + 12);
    v6[3] = 0;
    v6[4] = -1;
    *v6 = 0;
    v9 = 2 * v8 + 10;
    v7[1] = v9;
    v10 = operator new(4 * v9 + 4);
    v11 = v7[1];
    v7[2] = (int)v10;
    v12 = 0;
    if ( v11 >= 0 )
    {
      do
      {
        ++v12;
        *(_DWORD *)(v7[2] + 4 * v12 - 4) = 0;
      }
      while ( v12 <= v7[1] );
    }
  }
  else
  {
    v7 = nullptr;
  }
  for ( i = 0; i <= *v7; *(_DWORD *)(v7[2] + 4 * i - 4) = 0 )
    ++i;
  *v7 = 0;
  v14 = dword_89C2DC * dword_89C2DC;
  if ( dword_89C2DC * dword_89C2DC > 0 )
  {
    v15 = 0;
    do
    {
      v15 += 80;
      --v14;
      *(_DWORD *)((char *)dword_ABED10 + v15 - 20) = -1;
    }
    while ( v14 != 0 );
  }
  v16 = *(_DWORD *)(this + 56);
  n = nullptr;
  for ( j = v16 - 1; j >= 0; *(_DWORD *)((char *)dword_ABED10 + v18 + 56) = -2 )
  {
    v18 = 80 * (*(__int16 *)(v159[11] + 4 * j) + dword_89C2DC * *(__int16 *)(v159[11] + 4 * j + 2));
    --j;
  }
  v19 = v159[3] / 3;
  v20 = v159[3] / 8;
  *(_QWORD *)&v154 = v19 - v20 + 1;
  v21 = (double)*(__int64 *)&v154;
  LODWORD(v154) = v20;
  v164 = v21;
  v161 = (double)*(__int64 *)&v154;
  do
  {
    *(_QWORD *)&v154 = (unsigned int)sub_65C780(&unk_ABE890);
    v172 = sub_7C5F00((double)*(__int64 *)&v154 * v164 * 2.328306437080797e-10 + v161);
  }
  while ( v172 > v19 );
  v22 = v159[14] - 1;
  v164 = (double)(unsigned int)v159[14];
  do
  {
    *(_QWORD *)&v154 = (unsigned int)sub_65C780(&unk_ABE890);
    v23 = sub_7C5F00((double)*(__int64 *)&v154 * v164 * 2.328306437080797e-10);
  }
  while ( v23 > v22 );
  v24 = v159[11];
  v25 = Block;
  v160 = 1;
  v163 = *(_DWORD *)(v24 + 4 * v23);
  *(_DWORD *)Block = v163;
  *((_DWORD *)v25 + 1) = 0;
  *((_DWORD *)dword_ABED10 + 20 * (__int16)v163 + 20 * dword_89C2DC * SHIWORD(v163) + 15) = -3;
  v26 = *v7 + 1;
  v157 = *((float *)v25 + 1);
  v27 = v26 >> 1;
  if ( v26 < v7[1] )
  {
    for ( ; v26 > 1; v27 >>= 1 )
    {
      v28 = v7[2];
      v29 = *(_DWORD *)(v28 + 4 * v27);
      if ( *(float *)(v29 + 4) <= (double)v157 )
        break;
      *(_DWORD *)(v28 + 4 * v26) = v29;
      v26 = v27;
    }
    *(_DWORD *)(v7[2] + 4 * v26) = v25;
    v30 = v7[3];
    ++*v7;
    if ( (unsigned int)v25 > v30 )
      v7[3] = (int)v25;
    if ( (unsigned int)v25 < v7[4] )
      v7[4] = (int)v25;
  }
  if ( *v7 != 0 )
  {
    v32 = v7[2];
    v31 = *(__int16 **)(v32 + 4);
    *(_DWORD *)(v32 + 4) = *(_DWORD *)(v32 + 4 * *v7);
    *(_DWORD *)(v7[2] + 4 * (*v7)--) = 0;
    sub_5AD870(1);
  }
  else
  {
    v31 = nullptr;
  }
  v153 = v31;
  v154 = (double)(unsigned int)sub_65C780(&unk_ABE890) * 0.000000001462918079607772;
  if ( v31 != nullptr )
  {
    do
    {
      if ( (int)n >= v172 )
        break;
      v33 = v153;
      if ( dword_ABED10 != nullptr )
        *((_DWORD *)dword_ABED10 + 20 * *v153 + 20 * dword_89C2DC * v153[1] + 14) = -3;
      LODWORD(v158) = *v33 + dword_89C2DC * v33[1];
      v143 = 0;
      v157 = COERCE_FLOAT(&dword_89A304);
      v34 = (float *)((char *)Block + 8 * v160);
      do
      {
        LODWORD(v165) = *(_DWORD *)sub_42D510(&v164, 4 * (v143 & 7) + 9041544);
        v162 = v165;
        v35 = SWORD1(v165) + (__int16)v165;
        if ( v35 > dword_ABED04
          && (__int16)v165 - SWORD1(v165) < dword_ABED04
          && SWORD1(v165) - (__int16)v165 < dword_ABED04
          && v35 <= dword_ABED08
          && dword_ABED10 != nullptr )
        {
          v36 = (char *)dword_ABED10 + 80 * (__int16)v165 + 80 * dword_89C2DC * SWORD1(v165);
          if ( *((_DWORD *)v36 + 14) == -2 && *((_DWORD *)v36 + 15) != -3 )
          {
            v37 = (_DWORD *)sub_5657A0(&v162);
            if ( sub_486380(v37) )
            {
              v38 = HIDWORD(v154);
              v39 = LODWORD(v154);
              *(_DWORD *)v34 = v162;
              v40 = sub_58C6F0((__int16 *)&v163, (__int16 *)&v162, COERCE_DOUBLE(__PAIR64__(v38, v39)));
              v41 = v157;
              v42 = LODWORD(v158);
              v34[1] = v40;
              v43 = *(_DWORD *)LODWORD(v41) + v42;
              v44 = v34;
              v34 += 2;
              v45 = v160 + 1;
              *((_DWORD *)dword_ABED10 + 20 * v43 + 15) = -3;
              v46 = *((_DWORD *)v44 + 1);
              v47 = *v7 + 1;
              v160 = v45;
              LODWORD(v161) = v46;
              v48 = v47 >> 1;
              if ( v47 < v7[1] )
              {
                for ( ; v47 > 1; v48 >>= 1 )
                {
                  v49 = v7[2];
                  if ( *(float *)(*(_DWORD *)(v49 + 4 * v48) + 4) <= (double)*(float *)&v161 )
                    break;
                  *(_DWORD *)(v49 + 4 * v47) = *(_DWORD *)(v49 + 4 * v48);
                  v47 = v48;
                }
                *(_DWORD *)(v7[2] + 4 * v47) = v44;
                v50 = v7[3];
                ++*v7;
                if ( (unsigned int)v44 > v50 )
                  v7[3] = (int)v44;
                if ( (unsigned int)v44 < v7[4] )
                  v7[4] = (int)v44;
              }
            }
          }
        }
        v51 = LODWORD(v157) + 8 < (int)&unk_89A324;
        v143 += 2;
        LODWORD(v157) += 8;
      }
      while ( v51 );
      n = (char *)n + 1;
      v52 = sub_5980C0((double *)&byte_ABDFB8);
      v53 = *v7;
      v54 = *v7 == 0;
      v154 = v52 * 0.3926990816987241 + v154;
      if ( v54 )
        break;
      v55 = v7[2];
      v56 = *(__int16 **)(v55 + 4);
      *(_DWORD *)(v55 + 4) = *(_DWORD *)(v55 + 4 * v53);
      *(_DWORD *)(v7[2] + 4 * (*v7)--) = 0;
      sub_5AD870(1);
      v153 = v56;
    }
    while ( v56 != nullptr );
  }
  v57 = dword_89C2DC * dword_89C2DC;
  if ( dword_89C2DC * dword_89C2DC > 0 )
  {
    v58 = 0;
    do
    {
      v58 += 80;
      --v57;
      *(_DWORD *)((char *)dword_ABED10 + v58 - 20) = -1;
    }
    while ( v57 != 0 );
  }
  if ( *v7 != 0 )
  {
    v60 = v7[2];
    v59 = *(_DWORD **)(v60 + 4);
    *(_DWORD *)(v60 + 4) = *(_DWORD *)(v60 + 4 * *v7);
    *(_DWORD *)(v7[2] + 4 * (*v7)--) = 0;
    sub_5AD870(1);
  }
  else
  {
    v59 = nullptr;
  }
  sub_42FCB0(0, 0);
  v173 = &DynamicVectorClass<Cell>::`vftable';
  v177 = 10;
  v176 = 0;
  while ( v59 != nullptr )
  {
    LODWORD(v161) = *v59;
    *((_DWORD *)dword_ABED10 + 20 * SLOWORD(v161) + 20 * dword_89C2DC * SWORD1(v161) + 14) = -3;
    if ( *v7 == 0 )
      break;
    v61 = v7[2];
    v59 = *(_DWORD **)(v61 + 4);
    *(_DWORD *)(v61 + 4) = *(_DWORD *)(v61 + 4 * *v7);
    *(_DWORD *)(v7[2] + 4 * (*v7)--) = 0;
    sub_5AD870(1);
  }
  operator delete(Block);
  if ( v7 != nullptr )
  {
    operator delete((void *)v7[2]);
    operator delete(v7);
  }
  sub_5AD740(0, 0);
  v62 = v159;
  v166 = (void **)&off_7ED858;
  v171 = 10;
  v170 = 0;
  v63 = v159[14] - 1;
  v153 = (__int16 *)v63;
  if ( v63 >= 0 )
  {
    v64 = (char *)dword_ABED10;
    do
    {
      v65 = *(_DWORD *)(v62[11] + 4 * v63);
      LODWORD(v161) = v65;
      v66 = 80 * ((__int16)v65 + dword_89C2DC * SHIWORD(v65));
      if ( *(int *)&v64[v66 + 56] < -1 )
      {
        LODWORD(v165) = *(_DWORD *)&v64[v66 + 56];
        if ( operator new(0x50u) != nullptr )
          v67 = sub_58BF70(v65);
        else
          v67 = 0;
        v68 = *(_DWORD *)(v67 + 48);
        v69 = *(_DWORD *)(v67 + 56);
        v70 = v67 + 40;
        n = (void *)v67;
        if ( v69 < v68
          || (*(_BYTE *)(v67 + 53) != 0 || v68 == 0)
          && (v71 = *(_DWORD *)(v67 + 60)) > 0
          && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)v70 + 8))(v67 + 40, v68 + v71, 0) != 0 )
        {
          v72 = *(_DWORD *)(v67 + 56);
          v73 = *(_DWORD *)(v67 + 44);
          *(_DWORD *)(v67 + 56) = v72 + 1;
          *(_DWORD *)(v73 + 4 * v72) = v65;
        }
        ++*(_DWORD *)(v67 + 12);
        if ( v170 < v168
          || (BYTE1(v169) != 0 || v168 == 0)
          && v171 > 0
          && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v166[2])(&v166, v171 + v168, 0) != 0 )
        {
          v74 = v170++;
          *((_DWORD *)v167 + v74) = v67;
        }
        *(_DWORD *)((char *)dword_ABED10 + v66 + 56) = *(_DWORD *)(v67 + 8);
        sub_42FCB0(0, 0);
        v147 = &DynamicVectorClass<Cell>::`vftable';
        jj = 0;
        v152 = 100000;
        if ( v149 > 0 || (v150 != 0 || v149 == 0) && (unsigned __int8)sub_42F860(v149 + 100000, 0) != 0 )
        {
          v75 = jj++;
          *(_DWORD *)(v148 + 4 * v75) = v65;
        }
        v76 = jj;
        for ( k = jj; jj != 0; k = jj )
        {
          v78 = v148;
          v79 = k - 1;
          LODWORD(v158) = *(_DWORD *)(v148 + 4 * v79);
          if ( v79 < v76 )
          {
            jj = v76 - 1;
            if ( v79 < v76 - 1 )
            {
              while ( 1 )
              {
                *(_DWORD *)(v78 + 4 * v79) = *(_DWORD *)(v78 + 4 * v79 + 4);
                if ( ++v79 >= jj )
                  break;
                v78 = v148;
              }
            }
          }
          v80 = 0;
          for ( m = 0; m < 8; ++m )
          {
            v81 = *(_DWORD *)sub_42D510(&v164, 4 * (v80 & 7) + 9041544);
            LODWORD(v161) = v81;
            v82 = SHIWORD(v81) + (__int16)v81;
            if ( v82 > dword_ABED04
              && (__int16)v81 - SHIWORD(v81) < dword_ABED04
              && SHIWORD(v81) - (__int16)v81 < dword_ABED04
              && v82 <= dword_ABED08 )
            {
              v83 = (char *)dword_ABED10 + 80 * (__int16)v81 + 80 * dword_89C2DC * SHIWORD(v81);
              if ( *((_DWORD *)v83 + 14) == (_DWORD)v165 )
              {
                v84 = *(_DWORD *)(v70 + 8);
                if ( *(_DWORD *)(v70 + 16) < v84
                  || (*(_BYTE *)(v70 + 13) != 0 || v84 == 0)
                  && (v85 = *(_DWORD *)(v70 + 20)) > 0
                  && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)v70 + 8))(v70, v85 + v84, 0) != 0 )
                {
                  v86 = *(_DWORD *)(v70 + 16);
                  v87 = *(_DWORD *)(v70 + 4);
                  *(_DWORD *)(v70 + 16) = v86 + 1;
                  *(_DWORD *)(v87 + 4 * v86) = v81;
                }
                v88 = n;
                ++*((_DWORD *)n + 3);
                *((_DWORD *)v83 + 14) = v88[2];
                if ( jj < v149
                  || (v150 != 0 || v149 == 0)
                  && v152 > 0
                  && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v147[2])(&v147, v152 + v149, 0) != 0 )
                {
                  v89 = jj++;
                  *(_DWORD *)(v148 + 4 * v89) = v81;
                }
              }
            }
            v80 = m + 1;
          }
          v76 = jj;
        }
        v147 = &VectorClass<Cell>::`vftable';
        sub_42F7C0(&v147);
        v64 = (char *)dword_ABED10;
        v62 = v159;
        v63 = (int)v153;
      }
      v153 = (__int16 *)--v63;
    }
    while ( v63 >= 0 );
  }
  v90 = (__int16 *)(v170 - 1);
  v153 = (__int16 *)(v170 - 1);
  if ( v170 - 1 >= 0 )
  {
    while ( 1 )
    {
      v91 = *((_BYTE **)v167 + (_DWORD)v90);
      Block = v91;
      if ( v91[36] != 0 )
        goto LABEL_225;
      v92 = sub_58E5D0(v91);
      v93 = operator new(dword_ABED14);
      v94 = 0;
      for ( n = v93; v94 < (int)dword_ABED14; ++v94 )
        *((_BYTE *)v93 + v94) = 0;
      v95 = *(_DWORD *)(v92 + 16) - 1;
      for ( ii = v95; ii >= 0; --ii )
      {
        v96 = 0;
        LODWORD(v161) = *(_DWORD *)(*(_DWORD *)(v92 + 4) + 4 * v95);
        do
        {
          LODWORD(v158) = *(_DWORD *)sub_42D510(&v164, 4 * (v96 & 7) + 9041544);
          v97 = SWORD1(v158) + SLOWORD(v158);
          if ( v97 > dword_ABED04
            && SLOWORD(v158) - SWORD1(v158) < dword_ABED04
            && SWORD1(v158) - SLOWORD(v158) < dword_ABED04
            && v97 <= dword_ABED08 )
          {
            v98 = *((_DWORD *)dword_ABED10 + 20 * SLOWORD(v158) + 20 * dword_89C2DC * SWORD1(v158) + 14);
            if ( v98 >= 0 && v98 != *((_DWORD *)Block + 2) )
              *((_BYTE *)n + v98) = 1;
          }
          ++v96;
        }
        while ( v96 < 8 );
        v95 = ii - 1;
      }
      if ( v92 != 0 )
        (**(void (__thiscall ***)(int, int))v92)(v92, 1);
      v99 = -1;
      v100 = 0;
      v146 = 0;
      v160 = -1;
      v157 = NAN;
      v101 = -1;
      v102 = -1;
      if ( (int)dword_ABED14 > 0 )
      {
        do
        {
          if ( *((_BYTE *)n + v100) != 0 )
          {
            v103 = 0;
            if ( dword_ABDFA0 <= 0 )
            {
LABEL_144:
              v105 = 0;
            }
            else
            {
              v104 = (char *)dword_ABDF94;
              while ( *(_DWORD *)(*(_DWORD *)v104 + 8) != v100 )
              {
                ++v103;
                v104 += 4;
                if ( v103 >= dword_ABDFA0 )
                  goto LABEL_144;
              }
              v105 = *((_DWORD *)dword_ABDF94 + v103);
            }
            if ( *(_BYTE *)(v105 + 36) == 0 )
            {
              if ( *(_DWORD *)(v105 + 12) > SLODWORD(v157) && *(_BYTE *)(v105 + 20) == 0 )
              {
                v157 = *(float *)(v105 + 12);
                v146 = v105;
                v160 = *(_DWORD *)(v105 + 16);
              }
              if ( v101 == -1 )
              {
                v101 = *(_DWORD *)(v105 + 16);
                v102 = v101;
              }
              else
              {
                v106 = *(_DWORD *)(v105 + 16);
                if ( v106 > v102 )
                  v102 = v106;
                if ( v106 < v101 )
                  v101 = v106;
              }
            }
          }
          ++v100;
        }
        while ( v100 < (int)dword_ABED14 );
        v99 = v160;
      }
      sub_477BE0(0, 0);
      v147 = &DynamicVectorClass<int>::`vftable';
      v107 = v102 - v101;
      v152 = 10;
      jj = 0;
      if ( v102 != v101 )
      {
        if ( v107 != 4 )
        {
          if ( v107 == 8 )
          {
            v108 = (v102 + v101) / 2;
            if ( v149 > 0 || (v150 != 0 || v149 == 0) && (unsigned __int8)sub_477E10(v149 + 10, 0) != 0 )
            {
              v109 = jj++;
              *(_DWORD *)(v148 + 4 * v109) = v108;
            }
          }
          goto LABEL_192;
        }
        v110 = v149;
        if ( v149 <= 0 )
        {
          if ( v150 != 0 || v149 == 0 )
          {
            if ( (unsigned __int8)sub_477E10(v149 + 10, 0) != 0 )
              goto LABEL_170;
LABEL_171:
            v110 = v149;
          }
          if ( jj >= v110
            && (v150 == 0 && v110 != 0
             || v152 <= 0
             || ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v147[2])(&v147, v152 + v110, 0) == 0) )
          {
            goto LABEL_192;
          }
          goto LABEL_191;
        }
LABEL_170:
        v111 = jj++;
        *(_DWORD *)(v148 + 4 * v111) = v102;
        goto LABEL_171;
      }
      if ( v101 >= 4 )
      {
        v112 = v149;
        v113 = v101 - 4;
        if ( v149 > 0 )
          goto LABEL_183;
        if ( v150 == 0 && v149 != 0 )
          goto LABEL_185;
        if ( (unsigned __int8)sub_477E10(v149 + 10, 0) != 0 )
        {
LABEL_183:
          v114 = jj++;
          *(_DWORD *)(v148 + 4 * v114) = v113;
        }
      }
      v112 = v149;
LABEL_185:
      if ( v102 <= 7 )
      {
        v101 = v102 + 4;
        if ( jj >= v112
          && (v150 == 0 && v112 != 0
           || v152 <= 0
           || ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v147[2])(&v147, v152 + v112, 0) == 0) )
        {
          goto LABEL_192;
        }
LABEL_191:
        v115 = jj++;
        *(_DWORD *)(v148 + 4 * v115) = v101;
      }
LABEL_192:
      if ( dword_ABE014 == 3 || dword_ABE014 == 4 )
      {
        v116 = jj;
        v117 = jj - 1;
        if ( jj - 1 >= 0 )
        {
          v118 = v148;
          do
          {
            if ( *(_DWORD *)(v118 + 4 * v117) == 0 && v117 < v116 )
            {
              --v116;
              v119 = v117;
              for ( jj = v116; v119 < jj; ++v119 )
              {
                *(_DWORD *)(v118 + 4 * v119) = *(_DWORD *)(v118 + 4 * v119 + 4);
                v116 = jj;
                v118 = v148;
              }
            }
            --v117;
          }
          while ( v117 >= 0 );
        }
      }
      operator delete(n);
      if ( *((int *)Block + 3) <= 100 )
      {
        if ( v146 != 0 )
        {
          v127 = Block;
          v128 = *((_DWORD *)Block + 4);
          *((_DWORD *)Block + 4) = v99;
          v129 = v99 - v128;
          sub_578350(&stru_87F7E8);
          for ( kk = sub_578290(&stru_87F7E8); kk != 0; kk = sub_578290(&stru_87F7E8) )
          {
            LODWORD(v158) = *(_DWORD *)(kk + 36);
            if ( sub_58D0A0(&v158) == v127[2] )
              *(_BYTE *)(kk + 283) += v129;
          }
          for ( mm = v127[14] - 1;
                mm >= 0;
                *((_DWORD *)dword_ABED10 + 20 * (__int16)v134 + 20 * dword_89C2DC * SWORD1(v158) + 14) = *(_DWORD *)(v146 + 8) )
          {
            v132 = *(_DWORD *)(v146 + 48);
            v133 = *(_DWORD *)(v146 + 56);
            v134 = *(_DWORD *)(v127[11] + 4 * mm);
            LODWORD(v158) = v134;
            if ( v133 < v132
              || (*(_BYTE *)(v146 + 53) != 0 || v132 == 0)
              && (v135 = *(_DWORD *)(v146 + 60)) > 0
              && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)(v146 + 40) + 8))(
                   v146 + 40,
                   v135 + v132,
                   0) != 0 )
            {
              v136 = *(_DWORD *)(v146 + 56);
              v137 = *(_DWORD *)(v146 + 44);
              *(_DWORD *)(v146 + 56) = v136 + 1;
              *(_DWORD *)(v137 + 4 * v136) = v134;
            }
            ++*(_DWORD *)(v146 + 12);
            --mm;
          }
          *((_BYTE *)v127 + 36) = 1;
        }
      }
      else
      {
        v120 = *((_DWORD *)Block + 4);
        v121 = jj - 1;
        *(_QWORD *)&v154 = (unsigned int)jj;
        v158 = (double)(unsigned int)jj;
        do
        {
          v165 = (unsigned int)sub_65C780(&unk_ABE890);
          v122 = sub_7C5F00((double)v165 * v158 * 2.328306437080797e-10);
        }
        while ( v122 > v121 );
        v123 = *(_DWORD *)(v148 + 4 * v122);
        *((_DWORD *)Block + 4) = v123;
        v124 = v123 - v120;
        sub_578350(&stru_87F7E8);
        v125 = sub_578290(&stru_87F7E8);
        if ( v125 != 0 )
        {
          v126 = Block;
          do
          {
            LODWORD(v158) = *(_DWORD *)(v125 + 36);
            if ( sub_58D0A0(&v158) == v126[2] )
              *(_BYTE *)(v125 + 283) += v124;
            v125 = sub_578290(&stru_87F7E8);
          }
          while ( v125 != 0 );
        }
      }
      v147 = &VectorClass<int>::`vftable';
      sub_477D20(&v147);
LABEL_225:
      v153 = (__int16 *)((char *)v153 - 1);
      if ( (int)v153 < 0 )
      {
        v62 = v159;
        break;
      }
      v90 = v153;
    }
  }
  v138 = dword_ABDFA0 - 1;
  if ( dword_ABDFA0 - 1 >= 0 )
  {
    v139 = dword_ABDF94;
    do
    {
      v140 = v139[v138];
      if ( (_DWORD *)v140 != v62 && *(_BYTE *)(v140 + 36) != 0 )
      {
        v141 = (void *)v139[v138];
        if ( v140 != 0 )
        {
          sub_58C070(v140);
          operator delete(v141);
          v139 = dword_ABDF94;
        }
      }
      --v138;
    }
    while ( v138 >= 0 );
  }
  v142 = v167;
  v54 = v167 == nullptr;
  ++v62[7];
  v166 = &VectorClass<MapRegionClass *>::`vftable';
  if ( !v54 && BYTE1(v169) != 0 )
  {
    operator delete(v142);
    v167 = nullptr;
  }
  BYTE1(v169) = 0;
  v168 = 0;
  v173 = &VectorClass<Cell>::`vftable';
  if ( v174 != nullptr && v175 != 0 )
    operator delete(v174);
  return 1;
}
