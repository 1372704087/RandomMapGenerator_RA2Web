// 0x5a4b60 Patch_BlobGrow size=431

void __stdcall sub_5A4B60(int a1, int a2, int a3, int a4, char a5)
{
  int v5; // edi
  float *v6; // eax
  float *v7; // ebx
  int *v8; // eax
  int *v9; // esi
  void *v10; // eax
  int v11; // ecx
  int v12; // eax
  int v13; // eax
  bool v14; // sf
  unsigned int v15; // ecx
  unsigned int v16; // edx
  int v17; // edi
  int v18; // ebx
  unsigned int v19; // eax
  __int16 *v20; // eax
  int v21; // eax
  __int16 *v22; // edi
  _DWORD *v23; // eax
  int v24; // edx
  char v25; // al
  float *v26; // edi
  int *v27; // ebx
  int v28; // edx
  double v29; // st7
  int v30; // eax
  int v31; // edx
  unsigned int v32; // ebx
  float v33; // eax
  unsigned int v34; // ecx
  unsigned int v35; // eax
  unsigned int v36; // edx
  unsigned int v37; // eax
  int v38; // edi
  int v39; // eax
  int v40; // [esp+14h] [ebp-34h] BYREF
  __int16 *v41; // [esp+18h] [ebp-30h]
  float *v42; // [esp+1Ch] [ebp-2Ch]
  int v43; // [esp+20h] [ebp-28h]
  int v44; // [esp+24h] [ebp-24h]
  float v45; // [esp+28h] [ebp-20h]
  int v46; // [esp+2Ch] [ebp-1Ch]
  double v47; // [esp+30h] [ebp-18h]
  float v48; // [esp+38h] [ebp-10h]
  char v49[4]; // [esp+3Ch] [ebp-Ch] BYREF
  __int64 v50; // [esp+40h] [ebp-8h]

  v5 = 10 * a3;
  v6 = (float *)operator new(80 * a3);
  if ( v6 != nullptr )
  {
    v7 = v6;
    LODWORD(v48) = v5 - 1;
    v42 = v6;
  }
  else
  {
    v42 = nullptr;
    v7 = nullptr;
  }
  v8 = (int *)operator new(0x14u);
  v9 = v8;
  if ( v8 != nullptr )
  {
    v8[3] = 0;
    *v8 = 0;
    v8[4] = -1;
    v8[1] = v5;
    v10 = operator new(40 * a3 + 4);
    v11 = v9[1];
    v9[2] = (int)v10;
    v12 = 0;
    if ( v11 >= 0 )
    {
      do
      {
        ++v12;
        *(_DWORD *)(v9[2] + 4 * v12 - 4) = 0;
      }
      while ( v12 <= v9[1] );
    }
  }
  else
  {
    v9 = nullptr;
  }
  v13 = 0;
  v14 = *v9 < 0;
  v46 = 0;
  if ( !v14 )
  {
    do
    {
      ++v13;
      *(_DWORD *)(v9[2] + 4 * v13 - 4) = 0;
    }
    while ( v13 <= *v9 );
  }
  *v9 = 0;
  v43 = 1;
  *v7 = *(float *)(a1 + 36);
  v7[1] = 0.0;
  v45 = *(float *)(a1 + 36);
  *((_DWORD *)dword_ABED10 + 20 * SLOWORD(v45) + 20 * dword_89C2DC * SHIWORD(v45) + 15) = a4;
  v15 = *v9 + 1;
  v45 = v7[1];
  v16 = v15 >> 1;
  if ( v15 < v9[1] )
  {
    if ( v15 > 1 )
    {
      do
      {
        v17 = v9[2];
        v18 = *(_DWORD *)(v17 + 4 * v16);
        if ( *(float *)(v18 + 4) <= (double)v45 )
          break;
        *(_DWORD *)(v17 + 4 * v15) = v18;
        v15 = v16;
        v16 >>= 1;
      }
      while ( v15 > 1 );
      v7 = v42;
    }
    *(_DWORD *)(v9[2] + 4 * v15) = v7;
    v19 = v9[3];
    ++*v9;
    if ( (unsigned int)v7 > v19 )
      v9[3] = (int)v7;
    if ( (unsigned int)v7 < v9[4] )
      v9[4] = (int)v7;
  }
  if ( *v9 != 0 )
  {
    v21 = v9[2];
    v22 = *(__int16 **)(v21 + 4);
    *(_DWORD *)(v21 + 4) = *(_DWORD *)(v21 + 4 * *v9);
    *(_DWORD *)(v9[2] + 4 * (*v9)--) = 0;
    sub_5AD870(v9, 1);
    v41 = v22;
    v20 = v22;
  }
  else
  {
    v20 = nullptr;
    v41 = nullptr;
  }
  if ( a3 > 0 )
  {
    while ( v20 != nullptr )
    {
      v23 = sub_5657A0(&stru_87F7E8, v20);
      v24 = v43;
      v23[14] = a2;
      v25 = 0;
      v45 = 0.0;
      v26 = &v7[2 * v24];
      do
      {
        v40 = *(_DWORD *)sub_42D510(v49, 4 * (v25 & 7) + 9041544);
        v44 = SHIWORD(v40) + (__int16)v40;
        if ( v44 > dword_ABED04
          && (__int16)v40 - SHIWORD(v40) < dword_ABED04
          && SHIWORD(v40) - (__int16)v40 < dword_ABED04
          && v44 <= dword_ABED08 )
        {
          v27 = (int *)sub_5657A0(&stru_87F7E8, (__int16 *)&v40);
          v44 = (int)v27;
          if ( sub_486380(v27) || a5 != 0 && (sub_486670(v27) || sub_486650(v27)) )
          {
            v28 = SHIWORD(v40);
            LODWORD(v47) = (__int16)v40;
            if ( *((_DWORD *)dword_ABED10 + 20 * (__int16)v40 + 20 * dword_89C2DC * SHIWORD(v40) + 15) != a4
              && *(_BYTE *)(v44 + 284) == 0
              && *(_DWORD *)(v44 + 68) == -1
              && *(_DWORD *)(v44 + 228) == 0 )
            {
              *(_DWORD *)v26 = v40;
              v44 = *(_DWORD *)(a1 + 36);
              LODWORD(v47) = ((__int16)v44 - LODWORD(v47)) * ((__int16)v44 - LODWORD(v47))
                           + (SHIWORD(v44) - v28) * (SHIWORD(v44) - v28);
              v29 = (double)SLODWORD(v47);
              sub_4CAC40(v29);
              v47 = v29;
              v50 = (unsigned int)sub_65C780(&unk_ABE890);
              v30 = SHIWORD(v40);
              v31 = (__int16)v40;
              v26[1] = (double)v50 * 5.0 * 2.328306437080797e-10 + v47;
              *((_DWORD *)dword_ABED10 + 20 * v31 + 20 * dword_89C2DC * v30 + 15) = a4;
              v32 = (unsigned int)v26;
              ++v43;
              v33 = v26[1];
              v26 += 2;
              v34 = *v9 + 1;
              v48 = v33;
              v35 = v9[1];
              v36 = v34 >> 1;
              v44 = v32;
              if ( v34 < v35 )
              {
                for ( ; v34 > 1; v36 >>= 1 )
                {
                  LODWORD(v47) = *(_DWORD *)(v9[2] + 4 * v36);
                  if ( *(float *)(LODWORD(v47) + 4) <= (double)v48 )
                    break;
                  *(_DWORD *)(v9[2] + 4 * v34) = LODWORD(v47);
                  v32 = v44;
                  v34 = v36;
                }
                *(_DWORD *)(v9[2] + 4 * v34) = v32;
                v37 = v9[3];
                ++*v9;
                if ( v32 > v37 )
                  v9[3] = v32;
                if ( v32 < v9[4] )
                  v9[4] = v32;
              }
            }
          }
        }
        v25 = LOBYTE(v45) + 1;
        ++LODWORD(v45);
      }
      while ( SLODWORD(v45) < 8 );
      v38 = ++v46;
      v39 = sub_5AC960(v9);
      v7 = v42;
      v41 = (__int16 *)v39;
      if ( v38 >= a3 )
        break;
      v20 = v41;
    }
  }
  operator delete(v7);
  if ( v9 != nullptr )
  {
    operator delete((void *)v9[2]);
    operator delete(v9);
  }
}
