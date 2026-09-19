// 0x59c920 Water_GrowLake size=B17

char __thiscall sub_59C920(int *this, _WORD *a2)
{
  int v3; // eax
  int v4; // eax
  int v5; // edi
  int v6; // esi
  void *v7; // eax
  int *v8; // esi
  int v9; // eax
  void *v10; // eax
  int v11; // ecx
  int v12; // eax
  int i; // eax
  _WORD *v14; // ecx
  int v15; // edi
  int v16; // eax
  int v17; // ecx
  int v18; // edx
  int *v19; // ecx
  int v20; // eax
  bool v21; // zf
  unsigned int v22; // ebx
  unsigned int v23; // eax
  __int16 v24; // di
  unsigned int v25; // ebx
  unsigned int v26; // eax
  __int16 v27; // cx
  __int16 v28; // ax
  _DWORD *v29; // eax
  int v31; // eax
  int v32; // ecx
  long double v33; // st7
  int v34; // eax
  int v35; // ecx
  int v36; // eax
  _DWORD *v37; // edi
  unsigned int v38; // ecx
  unsigned int v39; // edx
  int v40; // ebx
  unsigned int v41; // eax
  int v42; // ecx
  int v43; // eax
  __int16 *v44; // edi
  _DWORD *v45; // edx
  int v46; // eax
  char *v47; // edx
  float *v48; // ebx
  int v49; // ecx
  __int16 v50; // ax
  int v51; // ecx
  char *v52; // edi
  _DWORD *v53; // eax
  __int16 v54; // ax
  int v55; // edx
  double v56; // st7
  float *v57; // edi
  unsigned int v58; // ecx
  unsigned int v59; // edx
  unsigned int v60; // eax
  int v61; // edi
  int v62; // eax
  int v63; // edi
  int v64; // eax
  __int16 *v65; // edi
  int v66; // ebx
  char *v67; // edi
  int v68; // eax
  int *v69; // edi
  int j; // eax
  int v71; // ecx
  int v72; // ecx
  int v73; // esi
  int k; // eax
  char *v75; // ecx
  char v76; // [esp+1Bh] [ebp-5Dh]
  int v78; // [esp+20h] [ebp-58h] BYREF
  __int64 v79; // [esp+24h] [ebp-54h]
  int v80; // [esp+2Ch] [ebp-4Ch]
  void *Block; // [esp+30h] [ebp-48h]
  __int64 v82; // [esp+34h] [ebp-44h] BYREF
  __int64 v83; // [esp+3Ch] [ebp-3Ch]
  __int64 v84; // [esp+44h] [ebp-34h]
  int v85; // [esp+4Ch] [ebp-2Ch]
  double v86; // [esp+50h] [ebp-28h]
  double v87; // [esp+58h] [ebp-20h]
  double v88; // [esp+60h] [ebp-18h]
  double v89; // [esp+68h] [ebp-10h]
  double v90; // [esp+70h] [ebp-8h]

  v3 = *(this + 19);
  v76 = 1;
  LODWORD(v87) = v3;
  if ( v3 != 0 )
    v3 = sub_7C5F00((double)*(this + 97) * (double)*(this + 96) * (double)SLODWORD(v87) * 0.008 + 100.0);
  v4 = v3 - *(this + 193);
  LODWORD(v86) = v4;
  if ( v4 <= 75 )
    return 0;
  v5 = 2 * v4 + 2;
  v6 = v5;
  if ( v5 <= 100 )
    v6 = 100;
  v7 = operator new(8 * v6);
  if ( v7 != nullptr )
  {
    Block = v7;
    LODWORD(v89) = v6 - 1;
  }
  else
  {
    Block = nullptr;
  }
  v8 = (int *)operator new(0x14u);
  if ( v8 != nullptr )
  {
    v9 = v5;
    if ( v5 <= 100 )
      v9 = 100;
    v8[3] = 0;
    v8[4] = -1;
    *v8 = 0;
    v8[1] = v9;
    v10 = operator new(4 * v9 + 4);
    v11 = v8[1];
    v8[2] = (int)v10;
    v12 = 0;
    if ( v11 >= 0 )
    {
      do
      {
        ++v12;
        *(_DWORD *)(v8[2] + 4 * v12 - 4) = 0;
      }
      while ( v12 <= v8[1] );
    }
  }
  else
  {
    v8 = nullptr;
  }
  sub_578350(&stru_87F7E8);
  for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
  {
    LODWORD(v87) = *(_DWORD *)(i + 36);
    *((_DWORD *)dword_ABED10 + 20 * SLOWORD(v87) + 20 * dword_89C2DC * SWORD1(v87) + 15) = 0;
  }
  v14 = a2;
  v15 = dword_89C2DC * dword_89C2DC;
  if ( *a2 != 0 || a2[1] != 0 )
  {
    if ( v15 > 0 )
    {
      v31 = 0;
      do
      {
        v31 += 80;
        --v15;
        *((char *)dword_ABED10 + v31 - 12) = 1;
      }
      while ( v15 != 0 );
    }
  }
  else
  {
    if ( v15 > 0 )
    {
      v16 = 0;
      v17 = dword_89C2DC * dword_89C2DC;
      do
      {
        v16 += 80;
        --v17;
        *((char *)dword_ABED10 + v16 - 12) = 0;
      }
      while ( v17 != 0 );
    }
    sub_5A0410(0, 2, -2);
    if ( v15 > 0 )
    {
      v18 = 0;
      do
      {
        v19 = (int *)((char *)dword_ABED10 + v18 + 56);
        v20 = *v19;
        if ( *v19 == 0 || v20 == *(this + 194) )
        {
          *((_BYTE *)dword_ABED10 + v18 + 68) = 1;
        }
        else if ( v20 == -2 )
        {
          *v19 = 0;
        }
        v18 += 80;
        --v15;
      }
      while ( v15 != 0 );
    }
    v14 = a2;
  }
  v21 = *v14 == 0;
  v80 = 0;
  if ( v21 && v14[1] == 0 )
  {
    while ( 1 )
    {
      v22 = dword_87F8DC - 1;
      v84 = (unsigned int)dword_87F8DC;
      v90 = (double)(unsigned int)dword_87F8DC;
      do
      {
        v83 = (unsigned int)sub_65C780(&unk_ABE890);
        v23 = sub_7C5F00((double)v83 * v90 * 2.328306437080797e-10);
        v24 = v23;
      }
      while ( v23 > v22 );
      v25 = dword_87F8E0 - 1;
      v82 = (unsigned int)dword_87F8E0;
      v90 = (double)(unsigned int)dword_87F8E0;
      do
      {
        v79 = (unsigned int)sub_65C780(&unk_ABE890);
        v26 = sub_7C5F00((double)v79 * v90 * 2.328306437080797e-10);
      }
      while ( v26 > v25 );
      WORD1(v88) = -v24;
      WORD1(v87) = dword_87F8DC;
      LOWORD(v89) = v24 + 1;
      WORD1(v89) = dword_87F8DC - v24;
      v27 = v26 + v24 + 1;
      v28 = dword_87F8DC - v24 + v26;
      LOWORD(v85) = v27;
      HIWORD(v85) = v28;
      v78 = v85;
      if ( ++v80 >= 200 )
        return 0;
      if ( dword_ABED10 != nullptr && *((_DWORD *)dword_ABED10 + 20 * v27 + 20 * dword_89C2DC * v28 + 14) == 0 )
      {
        v29 = (_DWORD *)sub_5657A0(&v78);
        if ( sub_486380(v29)
          && *((_BYTE *)dword_ABED10 + 80 * (__int16)v78 + 80 * dword_89C2DC * SHIWORD(v78) + 68) != 0 )
        {
          if ( v80 < 200 )
            goto LABEL_50;
          return 0;
        }
      }
    }
  }
  v78 = *(_DWORD *)v14;
LABEL_50:
  v32 = LODWORD(v86);
  LODWORD(v79) = 0;
  v85 = 76;
  if ( SLODWORD(v86) >= 76 )
    v85 = LODWORD(v86);
  v86 = (double)v85;
  v89 = (double)(v32 / 6);
  LODWORD(v87) = v32 / 3;
  v88 = (double)(v32 / 3);
  if ( v88 - v89 > v86 || v88 + v89 < 75.0 )
  {
    v89 = (v86 - 75.0) * 0.5;
    v88 = v89 + 75.0;
  }
  do
  {
    do
    {
      v33 = sub_5980C0((double *)&byte_ABDFB8);
      v87 = v33 * v89 + v88;
    }
    while ( v87 < 75.0 );
  }
  while ( v87 > v86 );
  v34 = sub_7C5F00(v87);
  v35 = *v8;
  v85 = v34;
  v36 = 0;
  if ( v35 >= 0 )
  {
    do
    {
      ++v36;
      *(_DWORD *)(v8[2] + 4 * v36 - 4) = 0;
    }
    while ( v36 <= *v8 );
  }
  v37 = Block;
  *v8 = 0;
  LODWORD(v83) = 1;
  *v37 = v78;
  v37[1] = 0;
  *((_DWORD *)dword_ABED10 + 20 * (__int16)v78 + 20 * dword_89C2DC * SHIWORD(v78) + 15) = *(this + 194);
  v38 = *v8 + 1;
  LODWORD(v87) = v37[1];
  v39 = v38 >> 1;
  if ( v38 < v8[1] )
  {
    for ( ; v38 > 1; v39 >>= 1 )
    {
      v40 = v8[2];
      if ( *(float *)(*(_DWORD *)(v40 + 4 * v39) + 4) <= (double)*(float *)&v87 )
        break;
      *(_DWORD *)(v40 + 4 * v38) = *(_DWORD *)(v40 + 4 * v39);
      v38 = v39;
    }
    *(_DWORD *)(v8[2] + 4 * v38) = v37;
    v41 = v8[3];
    ++*v8;
    if ( (unsigned int)v37 > v41 )
      v8[3] = (int)v37;
    if ( (unsigned int)v37 < v8[4] )
      v8[4] = (int)v37;
  }
  v42 = *v8;
  if ( *v8 != 0 )
  {
    v43 = v8[2];
    v44 = *(__int16 **)(v43 + 4);
    *(_DWORD *)(v43 + 4) = *(_DWORD *)(v43 + 4 * v42);
    *(_DWORD *)(v8[2] + 4 * (*v8)--) = 0;
    sub_5AD870(1);
    v42 = (int)v44;
  }
  v80 = v42;
  if ( v85 > 0 )
  {
    v45 = dword_ABED10;
    while ( v42 != 0 && v76 != 0 )
    {
      if ( v45 != nullptr )
        v45[20 * *(__int16 *)v42 + 14 + 20 * dword_89C2DC * *(__int16 *)(v42 + 2)] = *(this + 194);
      v46 = sub_5657A0(v42);
      v47 = (char *)Block;
      *(_DWORD *)(v46 + 56) = dword_AA0738;
      *(_BYTE *)(v46 + 282) = 0;
      LODWORD(v84) = 0;
      v48 = (float *)&v47[8 * v83];
      do
      {
        v49 = v84 & 7;
        v50 = LOWORD(dword_89F688[v49]) + *(_WORD *)v80;
        LOWORD(v49) = HIWORD(dword_89F688[v49]);
        LOWORD(v86) = v50;
        WORD1(v86) = *(_WORD *)(v80 + 2) + v49;
        LODWORD(v82) = LODWORD(v86);
        v51 = SWORD1(v86) + v50;
        if ( v51 > dword_ABED04
          && v50 - SWORD1(v86) < dword_ABED04
          && SWORD1(v86) - v50 < dword_ABED04
          && v51 <= dword_ABED08 )
        {
          v52 = (char *)dword_ABED10 + 80 * v50 + 80 * dword_89C2DC * SWORD1(v86);
          if ( *((_DWORD *)v52 + 14) != 0
            || *((_DWORD *)v52 + 15) == *(this + 194)
            || (v53 = (_DWORD *)sub_5657A0(&v82), !sub_486380(v53))
            || v52[68] == 0 )
          {
            v61 = *((_DWORD *)v52 + 14);
            if ( v61 != 0 && v61 != *(this + 194) )
              v76 = 0;
          }
          else
          {
            v54 = v82;
            v55 = SWORD1(v82);
            *(_DWORD *)v48 = v82;
            LODWORD(v87) = ((__int16)v78 - v54) * ((__int16)v78 - v54) + (SHIWORD(v78) - v55) * (SHIWORD(v78) - v55);
            v56 = (double)SLODWORD(v87);
            sub_4CAC40(v56);
            *(float *)&v87 = v56;
            *(_QWORD *)&v90 = (unsigned int)sub_65C780(&unk_ABE890);
            LODWORD(v83) = v83 + 1;
            v48[1] = 10.0 * ((double)*(__int64 *)&v90 * 2.328306437080797e-10)
                   + *(float *)&v87 * 0.5
                   - (double)(int)v79 * 0.02;
            *((_DWORD *)v52 + 15) = *(this + 194);
            v57 = v48;
            v48 += 2;
            v58 = *v8 + 1;
            LODWORD(v87) = v48;
            *(float *)&v88 = v57[1];
            v59 = v58 >> 1;
            if ( v58 < v8[1] )
            {
              for ( ; v58 > 1; v59 >>= 1 )
              {
                LODWORD(v89) = *(_DWORD *)(v8[2] + 4 * v59);
                if ( *(float *)(LODWORD(v89) + 4) <= (double)*(float *)&v88 )
                  break;
                *(_DWORD *)(v8[2] + 4 * v58) = LODWORD(v89);
                v48 = (float *)LODWORD(v87);
                v58 = v59;
              }
              *(_DWORD *)(v8[2] + 4 * v58) = v57;
              v60 = v8[3];
              ++*v8;
              if ( (unsigned int)v57 > v60 )
                v8[3] = (int)v57;
              if ( (unsigned int)v57 < v8[4] )
                v8[4] = (int)v57;
            }
          }
        }
        LODWORD(v84) = v84 + 2;
      }
      while ( (int)v84 < 8 );
      LODWORD(v79) = v79 + 1;
      if ( *v8 != 0 )
      {
        v62 = v8[2];
        v63 = *(_DWORD *)(v62 + 4);
        *(_DWORD *)(v62 + 4) = *(_DWORD *)(v62 + 4 * *v8);
        *(_DWORD *)(v8[2] + 4 * (*v8)--) = 0;
        sub_5AD870(1);
        v80 = v63;
      }
      else
      {
        v80 = 0;
      }
      if ( (int)v79 >= v85 )
        break;
      v45 = dword_ABED10;
      v42 = v80;
    }
  }
  if ( *v8 != 0 )
  {
    v64 = v8[2];
    v65 = *(__int16 **)(v64 + 4);
    *(_DWORD *)(v64 + 4) = *(_DWORD *)(v64 + 4 * *v8);
    *(_DWORD *)(v8[2] + 4 * (*v8)--) = 0;
    sub_5AD870(1);
    if ( v65 != nullptr )
    {
      while ( v76 != 0 )
      {
        v66 = sub_5657A0(v65);
        v67 = (char *)dword_ABED10 + 80 * *v65 + 80 * dword_89C2DC * v65[1];
        if ( *((_DWORD *)v67 + 14) == 0 && sub_486380((_DWORD *)v66) && v67[68] != 0 )
        {
          *(_DWORD *)(v66 + 56) = dword_AA0738;
          *(_BYTE *)(v66 + 282) = 0;
          *((_DWORD *)v67 + 14) = *(this + 194);
        }
        else
        {
          v76 = 0;
        }
        if ( *v8 != 0 )
        {
          v68 = v8[2];
          v65 = *(__int16 **)(v68 + 4);
          *(_DWORD *)(v68 + 4) = *(_DWORD *)(v68 + 4 * *v8);
          *(_DWORD *)(v8[2] + 4 * (*v8)--) = 0;
          sub_5AD870(1);
        }
        else
        {
          v65 = nullptr;
        }
        LODWORD(v79) = v79 + 1;
        if ( v65 == nullptr )
          goto LABEL_113;
      }
      goto LABEL_121;
    }
  }
LABEL_113:
  if ( v76 == 0 )
  {
LABEL_121:
    v69 = this;
    goto LABEL_122;
  }
  if ( (int)v79 <= 75 || (int)v79 <= v85 / 4 )
  {
    v76 = 0;
    goto LABEL_121;
  }
  v76 = 1;
  if ( *a2 != 0 || a2[1] != 0 )
  {
    v69 = this;
LABEL_127:
    if ( *a2 == 0 && a2[1] == 0 )
    {
      v69 = this;
      v76 = sub_5A0160(*(this + 194), 1, 0, 0, 512, 512, 0, 0);
      if ( v76 != 0 )
      {
        LODWORD(v89) = *(this + 194);
        sub_578350(&stru_87F7E8);
        for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
        {
          if ( dword_ABED10 != nullptr )
            v71 = *((_DWORD *)dword_ABED10 + 20 * *(__int16 *)(j + 36) + 20 * dword_89C2DC * *(__int16 *)(j + 38) + 14);
          else
            v71 = -1;
          if ( v71 == LODWORD(v89) )
          {
            v72 = *(_DWORD *)(j + 56);
            if ( v72 == 0 || v72 == 0xFFFF )
              *(_DWORD *)(j + 56) = dword_AA0E18;
          }
        }
        v76 = 1;
      }
    }
    goto LABEL_122;
  }
  v69 = this;
  v76 = sub_57A0C0(*(this + 194), 0);
  if ( v76 != 0 )
    goto LABEL_127;
LABEL_122:
  if ( v8 != nullptr )
  {
    operator delete((void *)v8[2]);
    operator delete(v8);
  }
  operator delete(Block);
  if ( v76 != 0 )
  {
    v69[193] += v79;
    return 1;
  }
  v73 = v69[194];
  sub_578350(&stru_87F7E8);
  for ( k = sub_578290(&stru_87F7E8); k != 0; k = sub_578290(&stru_87F7E8) )
  {
    LODWORD(v89) = *(_DWORD *)(k + 36);
    v75 = (char *)dword_ABED10 + 80 * SLOWORD(v89) + 80 * dword_89C2DC * SWORD1(v89);
    if ( *((_DWORD *)v75 + 14) == v73 )
    {
      *((_DWORD *)v75 + 14) = 0;
      v75[75] = 0;
      *(_DWORD *)(k + 56) = 0;
      *(_BYTE *)(k + 282) = 0;
      *(_BYTE *)(k + 283) = v69[195];
    }
  }
  return 0;
}
