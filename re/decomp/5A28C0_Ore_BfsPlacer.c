// 0x5a28c0 Ore_BfsPlacer size=60B

void __stdcall sub_5A28C0(__int16 *a1, int a2, int a3, char a4)
{
  __int16 *v4; // ebx
  int v5; // edi
  void *v6; // eax
  int *v7; // eax
  int *v8; // esi
  void *v9; // eax
  int v10; // ecx
  int v11; // eax
  int v12; // eax
  bool v13; // sf
  int i; // eax
  int j; // eax
  char *v16; // edi
  unsigned int v17; // ecx
  unsigned int v18; // edx
  int v19; // edi
  int v20; // ebx
  unsigned int v21; // eax
  int v22; // eax
  __int16 *v23; // ebx
  int v24; // edx
  _DWORD *v25; // ecx
  int v26; // eax
  int k; // eax
  int v28; // eax
  void **v29; // edi
  int v30; // eax
  unsigned int v31; // eax
  unsigned __int8 v32; // al
  float *v33; // edi
  int v34; // ecx
  __int16 v35; // ax
  _DWORD *v36; // ebx
  _DWORD *v37; // ecx
  int v38; // edx
  double v39; // st7
  int v40; // eax
  int v41; // edx
  float *v42; // ebx
  float v43; // eax
  unsigned int v44; // ecx
  unsigned int v45; // edx
  unsigned int v46; // eax
  int v47; // eax
  __int16 *v48; // edi
  char v49; // [esp+1Bh] [ebp-6Dh]
  __int16 *v50; // [esp+1Ch] [ebp-6Ch]
  _DWORD *v51; // [esp+20h] [ebp-68h] BYREF
  void *Block; // [esp+24h] [ebp-64h]
  int v53; // [esp+28h] [ebp-60h] BYREF
  int v54; // [esp+2Ch] [ebp-5Ch]
  int v55; // [esp+30h] [ebp-58h]
  int v56; // [esp+34h] [ebp-54h]
  int v57; // [esp+38h] [ebp-50h]
  _DWORD *v58; // [esp+3Ch] [ebp-4Ch]
  int v59; // [esp+40h] [ebp-48h]
  float v60; // [esp+44h] [ebp-44h]
  int v61; // [esp+48h] [ebp-40h]
  float v62; // [esp+4Ch] [ebp-3Ch]
  double v63; // [esp+50h] [ebp-38h]
  __int64 v64; // [esp+5Ch] [ebp-2Ch]
  __int64 v65; // [esp+64h] [ebp-24h]
  __int64 v66; // [esp+6Ch] [ebp-1Ch]
  char Buffer[20]; // [esp+74h] [ebp-14h] BYREF

  v4 = nullptr;
  v54 = 0;
  v5 = 10 * a2;
  v6 = operator new(80 * a2);
  if ( v6 != nullptr )
  {
    Block = v6;
    LODWORD(v63) = v5 - 1;
  }
  else
  {
    Block = nullptr;
  }
  v7 = (int *)operator new(0x14u);
  v8 = v7;
  if ( v7 != nullptr )
  {
    v7[3] = 0;
    v7[4] = -1;
    *v7 = 0;
    v7[1] = v5;
    v9 = operator new(40 * a2 + 4);
    v10 = v8[1];
    v8[2] = (int)v9;
    v11 = 0;
    if ( v10 >= 0 )
    {
      do
      {
        ++v11;
        *(_DWORD *)(v8[2] + 4 * v11 - 4) = 0;
      }
      while ( v11 <= v8[1] );
    }
  }
  else
  {
    v8 = nullptr;
  }
  v49 = 0;
  v53 = *(_DWORD *)a1;
  v12 = 0;
  v55 = 0;
  v61 = a4 != 0 ? 27 : 102;
  v13 = *v8 < 0;
  v56 = 0;
  if ( !v13 )
  {
    do
    {
      ++v12;
      *(_DWORD *)(v8[2] + 4 * v12 - 4) = 0;
    }
    while ( v12 <= *v8 );
  }
  *v8 = 0;
  v50 = nullptr;
  if ( a2 <= 0 )
    goto LABEL_72;
  while ( v56 < 10 )
  {
    if ( v4 != nullptr )
    {
      v16 = (char *)Block;
    }
    else
    {
      for ( i = 0; i <= *v8; *(_DWORD *)(v8[2] + 4 * i - 4) = 0 )
        ++i;
      *v8 = 0;
      sub_578350(&stru_87F7E8);
      for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
      {
        v59 = *(_DWORD *)(j + 36);
        *((_DWORD *)dword_ABED10 + 20 * (__int16)v59 + 20 * dword_89C2DC * SHIWORD(v59) + 15) = 0;
      }
      v16 = (char *)Block;
      v54 = 1;
      *(_DWORD *)Block = *(_DWORD *)a1;
      *((_DWORD *)v16 + 1) = 0;
      *((_DWORD *)dword_ABED10 + 20 * *a1 + 20 * dword_89C2DC * a1[1] + 15) = a3;
      v17 = *v8 + 1;
      v60 = *((float *)v16 + 1);
      v18 = v17 >> 1;
      if ( v17 < v8[1] )
      {
        if ( v17 > 1 )
        {
          do
          {
            v19 = v8[2];
            v20 = *(_DWORD *)(v19 + 4 * v18);
            if ( *(float *)(v20 + 4) <= (double)v60 )
              break;
            *(_DWORD *)(v19 + 4 * v17) = v20;
            v17 = v18;
            v18 >>= 1;
          }
          while ( v17 > 1 );
          v16 = (char *)Block;
        }
        *(_DWORD *)(v8[2] + 4 * v17) = v16;
        v21 = v8[3];
        ++*v8;
        if ( (unsigned int)v16 > v21 )
          v8[3] = (int)v16;
        if ( (unsigned int)v16 < v8[4] )
          v8[4] = (int)v16;
      }
      if ( *v8 != 0 )
      {
        v22 = v8[2];
        v23 = *(__int16 **)(v22 + 4);
        *(_DWORD *)(v22 + 4) = *(_DWORD *)(v22 + 4 * *v8);
        *(_DWORD *)(v8[2] + 4 * (*v8)--) = 0;
        sub_5AD870(v8, 1);
        v50 = v23;
      }
      else
      {
        v50 = nullptr;
      }
      v4 = v50;
      v24 = *(_DWORD *)a1;
      v49 = 0;
      ++v56;
      v53 = v24;
    }
    v25 = sub_5657A0(&stru_87F7E8, v4);
    v26 = *v4 + dword_89C2DC * v4[1];
    v51 = v25;
    if ( *((_BYTE *)dword_ABED10 + 80 * v26 + 69) != 0 )
      goto LABEL_49;
    if ( v49 == 0 )
    {
      v49 = 1;
      v53 = *(_DWORD *)v4;
      for ( k = 0; k <= *v8; *(_DWORD *)(v8[2] + 4 * k - 4) = 0 )
        ++k;
      *v8 = 0;
      v54 = 0;
      if ( a4 == 0 )
      {
        do
        {
          v64 = (unsigned int)sub_65C780(&unk_ABE890);
          v28 = sub_7C5F00((double)v64 * 6.984919311242392e-10 + 1.0);
        }
        while ( (unsigned int)v28 > 3 );
        sprintf(Buffer, "TIBTRE0%d", v28 % 10);
        v29 = (void **)operator new(0xE0u);
        if ( v29 != nullptr )
        {
          v30 = sub_71DD80(Buffer);
          sub_71BB90(v29, *((_DWORD *)dword_A8E31C + v30), (int)&v53);
        }
        v16 = (char *)Block;
        v25 = v51;
      }
    }
    if ( v25[17] == -1 )
    {
      do
      {
        v65 = (unsigned int)sub_65C780(&unk_ABE890);
        v31 = sub_7C5F00((double)v65 * 0.000000002793967724496957);
      }
      while ( v31 > 0xB );
      v51[17] = v61 + v31;
      goto LABEL_48;
    }
    v32 = *((_BYTE *)v25 + 286);
    if ( v32 < 0xBu )
    {
      *((_BYTE *)v25 + 286) = v32 + 1;
LABEL_48:
      ++v55;
    }
LABEL_49:
    v57 = 0;
    v33 = (float *)&v16[8 * v54];
    do
    {
      v34 = v57 & 7;
      v35 = v4[1] + HIWORD(dword_89F688[v34]);
      LOWORD(v58) = *v4 + LOWORD(dword_89F688[v34]);
      HIWORD(v58) = v35;
      v51 = v58;
      if ( (unsigned __int8)sub_578460(&v51, 1) == 0 )
        goto LABEL_67;
      v36 = sub_5657A0(&stru_87F7E8, (__int16 *)&v51);
      v59 = (int)v36;
      if ( sub_486380(v36) )
      {
        if ( v36[17] == -1 )
        {
          v37 = v51;
          if ( *((_DWORD *)dword_ABED10 + 20 * (__int16)v51 + 20 * dword_89C2DC * SHIWORD(v51) + 15) != a3 )
            goto LABEL_58;
          v36 = (_DWORD *)v59;
        }
        if ( *((_BYTE *)v36 + 286) < 0xBu && sub_485010(v36) != -1 )
        {
          v37 = v51;
LABEL_58:
          v38 = SHIWORD(v51);
          *(_DWORD *)v33 = v37;
          v59 = ((__int16)v53 - (__int16)v37) * ((__int16)v53 - (__int16)v37)
              + (SHIWORD(v53) - v38) * (SHIWORD(v53) - v38);
          v39 = (double)v59;
          sub_4CAC40(v39);
          v63 = v39;
          v66 = (unsigned int)sub_65C780(&unk_ABE890);
          v40 = SHIWORD(v51);
          v41 = (__int16)v51;
          v42 = v33;
          v33 += 2;
          v59 = (int)v42;
          *(v33 - 1) = (double)v66 * 5.0 * 2.328306437080797e-10 + v63;
          *((_DWORD *)dword_ABED10 + 20 * v41 + 20 * dword_89C2DC * v40 + 15) = a3;
          v43 = v42[1];
          ++v54;
          v44 = *v8 + 1;
          v62 = v43;
          v45 = v44 >> 1;
          if ( v44 < v8[1] )
          {
            for ( ; v44 > 1; v45 >>= 1 )
            {
              LODWORD(v63) = *(_DWORD *)(v8[2] + 4 * v45);
              if ( *(float *)(LODWORD(v63) + 4) <= (double)v62 )
                break;
              *(_DWORD *)(v8[2] + 4 * v44) = LODWORD(v63);
              v42 = (float *)v59;
              v44 = v45;
            }
            *(_DWORD *)(v8[2] + 4 * v44) = v42;
            v46 = v8[3];
            ++*v8;
            if ( (unsigned int)v42 > v46 )
              v8[3] = (int)v42;
            if ( (unsigned int)v42 < v8[4] )
              v8[4] = (int)v42;
          }
        }
      }
      v4 = v50;
LABEL_67:
      ++v57;
    }
    while ( v57 < 8 );
    if ( *v8 != 0 )
    {
      v47 = v8[2];
      v48 = *(__int16 **)(v47 + 4);
      *(_DWORD *)(v47 + 4) = *(_DWORD *)(v47 + 4 * *v8);
      *(_DWORD *)(v8[2] + 4 * (*v8)--) = 0;
      sub_5AD870(v8, 1);
      v50 = v48;
    }
    else
    {
      v50 = nullptr;
    }
    if ( v55 < a2 )
    {
      v4 = v50;
      continue;
    }
    break;
  }
LABEL_72:
  operator delete(Block);
  if ( v8 != nullptr )
  {
    operator delete((void *)v8[2]);
    operator delete(v8);
  }
}
