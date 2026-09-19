// 0x56c510 Zone_Recalc size=66E

int __thiscall sub_56C510(_DWORD *this)
{
  _DWORD *v1; // ebp
  _DWORD *v2; // esi
  int v3; // ebx
  int v4; // edx
  int v5; // eax
  int v6; // edi
  void **v7; // esi
  int i; // edi
  unsigned int j; // eax
  int v10; // edi
  int v11; // eax
  unsigned __int8 *v12; // esi
  int v13; // ebx
  int v14; // eax
  int v15; // eax
  int v16; // eax
  int v17; // eax
  int v18; // ecx
  __int16 *v19; // esi
  int v20; // edi
  int v21; // ecx
  int v22; // eax
  int v23; // ebx
  int v24; // eax
  int v25; // edx
  int v26; // ecx
  int v27; // ecx
  int v28; // ebx
  int v29; // esi
  int v30; // edx
  _DWORD *v31; // ecx
  int v32; // eax
  int v33; // ecx
  int v34; // eax
  int v35; // eax
  int v36; // edx
  bool v37; // zf
  _WORD *v38; // eax
  int v39; // ecx
  _WORD *v40; // ebx
  int v41; // eax
  _WORD *v42; // ecx
  int k; // edi
  int v44; // eax
  int v45; // esi
  int *v46; // edx
  int v47; // ecx
  _DWORD *v48; // edi
  unsigned __int16 *v49; // esi
  int v50; // eax
  _WORD *v51; // ecx
  int v52; // edx
  int v53; // eax
  int v54; // ecx
  int v55; // eax
  int v56; // edx
  int v57; // eax
  unsigned int v58; // ecx
  char *v59; // esi
  int v60; // ecx
  int *v61; // edi
  __int16 *v62; // eax
  int v63; // ecx
  __int16 *v64; // esi
  int v65; // ecx
  int v66; // eax
  __int16 *v67; // ecx
  int v68; // esi
  _WORD *v69; // edx
  unsigned __int16 v70; // ax
  unsigned __int16 *v71; // edi
  int v72; // ecx
  int v73; // edx
  int v74; // esi
  void **v75; // edi
  _DWORD *v77; // [esp+10h] [ebp-54h]
  __int16 v78; // [esp+14h] [ebp-50h]
  int *Block; // [esp+18h] [ebp-4Ch]
  unsigned __int8 *Blocka; // [esp+18h] [ebp-4Ch]
  int v81; // [esp+1Ch] [ebp-48h]
  __int16 *v82; // [esp+20h] [ebp-44h]
  __int16 **v83; // [esp+24h] [ebp-40h]
  int v84; // [esp+28h] [ebp-3Ch]
  int v85; // [esp+28h] [ebp-3Ch]
  int *v86; // [esp+28h] [ebp-3Ch]
  unsigned __int8 *v87; // [esp+2Ch] [ebp-38h]
  char *v88; // [esp+2Ch] [ebp-38h]
  char *v89; // [esp+2Ch] [ebp-38h]
  char *v90; // [esp+2Ch] [ebp-38h]
  _WORD *v91; // [esp+2Ch] [ebp-38h]
  int v92; // [esp+30h] [ebp-34h] BYREF
  int v93; // [esp+34h] [ebp-30h]
  int v94; // [esp+38h] [ebp-2Ch]
  int v95; // [esp+3Ch] [ebp-28h]
  int v96; // [esp+40h] [ebp-24h]
  _WORD *v97; // [esp+44h] [ebp-20h]
  _DWORD *v98; // [esp+48h] [ebp-1Ch]
  void **v99; // [esp+4Ch] [ebp-18h] BYREF
  void *v100; // [esp+50h] [ebp-14h]
  int v101; // [esp+54h] [ebp-10h]
  int v102; // [esp+58h] [ebp-Ch]
  int v103; // [esp+5Ch] [ebp-8h]
  int v104; // [esp+60h] [ebp-4h]

  v1 = this;
  v81 = -1;
  v95 = -1;
  v2 = (_DWORD *)*(this + 5);
  v3 = 0;
  v4 = *(this + 26) + 4 * *(this + 27);
  v100 = nullptr;
  v101 = 0;
  LOWORD(v102) = 1;
  v99 = &DynamicVectorClass<enum PassabilityType>::`vftable';
  v103 = 0;
  v104 = 300;
  v5 = v2[2];
  v98 = this;
  v87 = (unsigned __int8 *)v4;
  if ( v5 > 0 )
  {
    v6 = 0;
    do
    {
      (*(void (__thiscall **)(int))(*(_DWORD *)(*v2 + v6) + 12))(*v2 + v6);
      ++v3;
      v6 += 24;
    }
    while ( v3 < v2[2] );
  }
  v7 = (void **)(v1 + 6);
  for ( i = 13; i != 0; --i )
  {
    if ( *v7 != nullptr )
    {
      operator delete(*v7);
      *v7 = nullptr;
    }
    ++v7;
  }
  for ( j = v1[26]; j < (unsigned int)v87; j += 4 )
    *(_WORD *)(j + 2) = 0;
  v10 = 1;
  if ( v103 < v101
    || (BYTE1(v102) != 0 || v101 == 0)
    && v104 > 0
    && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v99[2])(&v99, v104 + v101, 0) != 0 )
  {
    v11 = v103++;
    *((_DWORD *)v100 + v11) = 7;
  }
  v12 = (unsigned __int8 *)v1[26];
  v92 = 0;
  if ( v12 < v87 )
  {
    v13 = v95;
    do
    {
      v14 = *v12;
      v95 = v14;
      if ( v14 == 7 || *((_WORD *)v12 + 1) != 0 )
      {
        v12 += 4;
      }
      else
      {
        dword_ABDE8C = 0;
        v15 = sub_56CB90(v12, v10, &v92);
        if ( v15 > v13 )
        {
          v13 = v15;
          v81 = (unsigned __int16)v10;
        }
        if ( v103 < v101
          || (BYTE1(v102) != 0 || v101 == 0)
          && v104 > 0
          && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v99[2])(&v99, v104 + v101, 0) != 0 )
        {
          v16 = v103++;
          *((_DWORD *)v100 + v16) = v95;
        }
        ++v10;
        v12 += 4 * v92;
      }
    }
    while ( v12 < v87 );
  }
  v1[19] = (unsigned __int16)v10;
  v17 = v1[24] - 1;
  if ( v17 >= 0 )
  {
    v18 = 16 * v17;
    v88 = (char *)(16 * v17);
    v84 = v1[24];
    do
    {
      v19 = (__int16 *)(v1[21] + v18);
      if ( *((_BYTE *)v19 + 8) != 0 )
      {
        v20 = v1[62] + v1[61] + 1;
        v21 = *v19 + v20 * v19[1];
        if ( v21 >= 0 )
        {
          v22 = v1[27];
          if ( v21 >= v22 )
            v21 = v22 - 1;
        }
        else
        {
          v21 = 0;
        }
        v23 = v1[26];
        v24 = *(unsigned __int16 *)(v23 + 4 * v21 + 2);
        v25 = v19[2] + v20 * v19[3];
        if ( v25 >= 0 )
        {
          v26 = v1[27];
          if ( v25 >= v26 )
            v25 = v26 - 1;
        }
        else
        {
          v25 = 0;
        }
        v27 = *(unsigned __int16 *)(v23 + 4 * v25 + 2);
        if ( (unsigned __int16)v27 != v24 )
        {
          if ( (unsigned __int16)v27 < v24 )
          {
            v27 = v24;
            v24 = *(unsigned __int16 *)(v23 + 4 * v25 + 2);
          }
          v28 = v27 | (v24 << 16);
          v29 = *(_DWORD *)v1[5] + 24 * (v27 & 0xF | (16 * (v24 & 0xF)));
          v30 = *(_DWORD *)(v29 + 16);
          v31 = *(_DWORD **)(v29 + 4);
          v32 = v30 - 1;
          if ( v30 - 1 < 0 )
          {
LABEL_48:
            v33 = *(_DWORD *)(v29 + 8);
            if ( v30 < v33
              || (*(_BYTE *)(v29 + 13) != 0 || v33 == 0)
              && (v34 = *(_DWORD *)(v29 + 20)) > 0
              && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)v29 + 8))(v29, v33 + v34, 0) != 0 )
            {
              v35 = *(_DWORD *)(v29 + 16);
              v36 = *(_DWORD *)(v29 + 4);
              *(_DWORD *)(v29 + 16) = v35 + 1;
              *(_DWORD *)(v36 + 8 * v35) = v28;
              *(_DWORD *)(v36 + 8 * v35 + 4) = v28;
            }
          }
          else
          {
            while ( v28 != *v31 )
            {
              v31 += 2;
              if ( --v32 < 0 )
                goto LABEL_48;
            }
          }
        }
      }
      v18 = (int)(v88 - 16);
      v37 = v84 == 1;
      v88 -= 16;
      --v84;
    }
    while ( !v37 );
  }
  v38 = operator new(2 * v1[19]);
  v39 = v1[19];
  v40 = v38;
  v41 = 0;
  v97 = v40;
  if ( v39 > 0 )
  {
    v42 = v40;
    do
    {
      *v42 = 0;
      ++v41;
      ++v42;
    }
    while ( v41 < v1[19] );
  }
  for ( k = 0; k < 6144; k += 24 )
  {
    v44 = k + *(_DWORD *)v1[5];
    v45 = *(_DWORD *)(v44 + 16);
    if ( v45 > 0 )
    {
      v46 = (int *)(*(_DWORD *)(v44 + 4) + 4);
      do
      {
        v47 = *v46;
        v46 += 2;
        ++v40[(unsigned __int16)v47];
        ++v40[HIWORD(v47)];
        --v45;
      }
      while ( v45 != 0 );
    }
  }
  v77 = operator new(4 * v1[19]);
  v89 = nullptr;
  if ( (int)v1[19] > 0 )
  {
    v48 = v77;
    v49 = v40;
    do
    {
      *v48++ = operator new(2 * *v49++);
      ++v89;
    }
    while ( (int)v89 < v1[19] );
  }
  v50 = 0;
  if ( (int)v1[19] > 0 )
  {
    v51 = v40;
    do
    {
      *v51 = 0;
      ++v50;
      ++v51;
    }
    while ( v50 < v1[19] );
  }
  v52 = 0;
  v85 = 0;
  do
  {
    v53 = *(_DWORD *)v1[5];
    v54 = *(_DWORD *)(v53 + v52 + 16);
    v55 = v52 + v53;
    if ( v54 > 0 )
    {
      v90 = (char *)v54;
      Block = (int *)(*(_DWORD *)(v55 + 4) + 4);
      do
      {
        v56 = *Block;
        v57 = (unsigned __int16)*Block;
        v58 = HIWORD(*Block);
        *(_WORD *)(v77[v57] + 2 * (unsigned __int16)v40[v57]) = v58;
        *(_WORD *)(v77[(unsigned __int16)v58] + 2 * (unsigned __int16)v40[(unsigned __int16)v58]) = v56;
        ++v40[v57];
        ++v40[(unsigned __int16)v58];
        v37 = v90 == (char *)1;
        Block += 2;
        --v90;
      }
      while ( !v37 );
      v52 = v85;
    }
    v52 += 24;
    v85 = v52;
  }
  while ( v52 < 6144 );
  v59 = (char *)operator new(v1[19]);
  v60 = 0;
  for ( Blocka = (unsigned __int8 *)v59; v60 < v1[19]; v59[v60 - 1] = *((char *)v100 + 4 * v60 - 4) )
    ++v60;
  v91 = operator new(2 * v1[19]);
  v61 = &dword_82A594;
  v86 = &dword_82A594;
  v83 = (__int16 **)(v1 + 6);
  do
  {
    v78 = 2;
    v62 = (__int16 *)operator new(2 * v1[19]);
    v82 = v62;
    *v83 = v62;
    v63 = 0;
    if ( (int)v1[19] > 0 )
    {
      v64 = v62;
      do
        *v64++ = v61[Blocka[v63++]] != 1;
      while ( v63 < v1[19] );
    }
    v65 = v1[19];
    v66 = 0;
    v94 = 0;
    if ( v65 > 0 )
    {
      v67 = v82;
      v95 = (int)v82;
      do
      {
        if ( *v67 == 0 )
        {
          v68 = 1;
          *v91 = v66;
          *v67 = v78;
          v96 = v61[Blocka[v66]];
          do
          {
            v69 = &v91[--v68];
            v70 = v40[(unsigned __int16)*v69];
            if ( v70 - 1 >= 0 )
            {
              v71 = (unsigned __int16 *)(v77[(unsigned __int16)*v69] + 2 * (v70 - 1));
              v93 = v70;
              do
              {
                v72 = *v71;
                if ( v86[Blocka[v72]] == v96 && v82[v72] == 0 )
                {
                  *v69 = v72;
                  ++v68;
                  ++v69;
                  v82[v72] = v78;
                }
                --v71;
                --v93;
              }
              while ( v93 != 0 );
              v40 = v97;
              v1 = v98;
            }
          }
          while ( v68 != 0 );
          v61 = v86;
          v67 = (__int16 *)v95;
          ++v78;
          v66 = v94;
        }
        v73 = v1[19];
        ++v66;
        ++v67;
        v94 = v66;
        v95 = (int)v67;
      }
      while ( v66 < v73 );
    }
    v61 += 8;
    *v82 = -1;
    ++v83;
    v86 = v61;
  }
  while ( (int)v61 < (int)&dword_82A734 );
  v74 = 0;
  if ( (int)v1[19] > 0 )
  {
    v75 = (void **)v77;
    do
    {
      operator delete(*v75);
      ++v74;
      ++v75;
    }
    while ( v74 < v1[19] );
  }
  operator delete(Blocka);
  operator delete(v77);
  operator delete(v40);
  operator delete(v91);
  v99 = &VectorClass<enum PassabilityType>::`vftable';
  if ( v100 != nullptr && BYTE1(v102) != 0 )
    operator delete(v100);
  return v81;
}
