// 0x5a45e0 Trees_Plant size=4F3

int __stdcall sub_5A45E0(int a1, int a2, double a3)
{
  int v3; // edi
  float *v4; // eax
  float *v5; // ebx
  _DWORD *v6; // eax
  _DWORD *v7; // esi
  void *v8; // eax
  int v9; // ecx
  int v10; // eax
  int i; // eax
  unsigned int v12; // ecx
  unsigned int v13; // edx
  int v14; // edi
  int v15; // ebx
  unsigned int v16; // eax
  _WORD *v17; // eax
  int v18; // eax
  _WORD *v19; // edi
  _DWORD *v20; // ebx
  int v21; // eax
  void **v22; // edi
  int v23; // eax
  char v24; // al
  int v25; // eax
  __int16 v26; // dx
  int v27; // ecx
  int v28; // eax
  char *v29; // edi
  double v30; // st7
  float *v31; // edi
  unsigned int v32; // ecx
  unsigned int v33; // edx
  int v34; // ebx
  unsigned int v35; // eax
  int v36; // eax
  _WORD *v37; // edi
  _WORD *v39; // [esp+18h] [ebp-58h]
  float *v40; // [esp+1Ch] [ebp-54h]
  int v41; // [esp+20h] [ebp-50h]
  int v42; // [esp+24h] [ebp-4Ch]
  int v43; // [esp+2Ch] [ebp-44h]
  float *v44; // [esp+30h] [ebp-40h]
  float v45; // [esp+38h] [ebp-38h]
  int v46; // [esp+38h] [ebp-38h]
  int v47; // [esp+3Ch] [ebp-34h] BYREF
  float v48; // [esp+40h] [ebp-30h]
  __int64 v49; // [esp+44h] [ebp-2Ch]
  __int64 v50; // [esp+4Ch] [ebp-24h]
  __int64 v51; // [esp+54h] [ebp-1Ch]
  char Buffer[20]; // [esp+5Ch] [ebp-14h] BYREF

  v3 = 25 * a2;
  v4 = (float *)operator new(200 * a2);
  if ( v4 != nullptr )
  {
    v5 = v4;
    LODWORD(v48) = v3 - 1;
    v40 = v4;
  }
  else
  {
    v40 = nullptr;
    v5 = nullptr;
  }
  v6 = operator new(0x14u);
  v7 = v6;
  if ( v6 != nullptr )
  {
    v6[3] = 0;
    v6[4] = -1;
    *v6 = 0;
    v6[1] = v3;
    v8 = operator new(100 * a2 + 4);
    v9 = v7[1];
    v7[2] = v8;
    v10 = 0;
    if ( v9 >= 0 )
    {
      do
      {
        ++v10;
        *(_DWORD *)(v7[2] + 4 * v10 - 4) = 0;
      }
      while ( v10 <= v7[1] );
    }
  }
  else
  {
    v7 = nullptr;
  }
  for ( i = 0; i <= *v7; *(_DWORD *)(v7[2] + 4 * i - 4) = 0 )
    ++i;
  *v7 = 0;
  v41 = 1;
  *v5 = *(float *)(a1 + 36);
  v5[1] = 0.0;
  *((_BYTE *)dword_ABED10
  + 80 * (__int16)*(_DWORD *)(a1 + 36)
  + 80 * dword_89C2DC * (__int16)HIWORD(*(_DWORD *)(a1 + 36))
  + 71) = 1;
  v12 = *v7 + 1;
  v45 = v5[1];
  v13 = v12 >> 1;
  if ( v12 < v7[1] )
  {
    if ( v12 > 1 )
    {
      do
      {
        v14 = v7[2];
        v15 = *(_DWORD *)(v14 + 4 * v13);
        if ( *(float *)(v15 + 4) <= (double)v45 )
          break;
        *(_DWORD *)(v14 + 4 * v12) = v15;
        v12 = v13;
        v13 >>= 1;
      }
      while ( v12 > 1 );
      v5 = v40;
      v3 = 25 * a2;
    }
    *(_DWORD *)(v7[2] + 4 * v12) = v5;
    v16 = v7[3];
    ++*v7;
    if ( (unsigned int)v5 > v16 )
      v7[3] = v5;
    if ( (unsigned int)v5 < v7[4] )
      v7[4] = v5;
  }
  if ( *v7 != 0 )
  {
    v18 = v7[2];
    v19 = *(_WORD **)(v18 + 4);
    *(_DWORD *)(v18 + 4) = *(_DWORD *)(v18 + 4 * *v7);
    *(_DWORD *)(v7[2] + 4 * (*v7)--) = 0;
    sub_5AD870(1);
    v39 = v19;
    v3 = 25 * a2;
    v17 = v39;
  }
  else
  {
    v17 = nullptr;
    v39 = nullptr;
  }
  v42 = 0;
  if ( a2 > 0 )
  {
    while ( v17 != nullptr && v41 < v3 )
    {
      v20 = (_DWORD *)sub_5657A0(v17);
      if ( sub_486380(v20) && v20[57] == 0 && v20[17] == -1 && v20[59] != 3 )
      {
        v49 = (unsigned int)sub_65C780(&unk_ABE890);
        if ( (double)v49 * 2.328306437080797e-10 < a3 )
        {
          do
          {
            v50 = (unsigned int)sub_65C780(&unk_ABE890);
            v21 = sub_7C5F00((double)v50 * 0.000000005820766092701993 + 1.0);
          }
          while ( (unsigned int)v21 > 0x19 );
          sprintf(Buffer, "TREE%d%d", v21 / 10, v21 % 10);
          v22 = (void **)operator new(0xE0u);
          if ( v22 != nullptr )
          {
            v47 = v20[9];
            v23 = sub_71DD80(Buffer);
            sub_71BB90(v22, *((_DWORD *)dword_A8E31C + v23), (int)&v47);
          }
          ++v42;
        }
      }
      v24 = 0;
      v46 = 0;
      v44 = &v40[2 * v41];
      do
      {
        v25 = v24 & 7;
        v26 = v39[1] + HIWORD(dword_89F688[v25]);
        LOWORD(v25) = *v39 + LOWORD(dword_89F688[v25]);
        HIWORD(v43) = v26;
        v27 = (__int16)v25;
        LOWORD(v43) = v25;
        v28 = v26 + (__int16)v25;
        if ( v28 > dword_ABED04 && v27 - v26 < dword_ABED04 && v26 - v27 < dword_ABED04 && v28 <= dword_ABED08 )
        {
          v29 = (char *)dword_ABED10 + 80 * v27 + 80 * dword_89C2DC * v26;
          if ( v29[71] == 0 && v29[69] == 0 && v41 < 25 * a2 )
          {
            *(_DWORD *)v44 = v43;
            v30 = (double)(((__int16)*(_DWORD *)(a1 + 36) - v27) * ((__int16)*(_DWORD *)(a1 + 36) - v27)
                         + ((__int16)HIWORD(*(_DWORD *)(a1 + 36)) - v26) * ((__int16)HIWORD(*(_DWORD *)(a1 + 36)) - v26));
            sub_4CAC40(v30);
            v51 = (unsigned int)sub_65C780(&unk_ABE890);
            ++v41;
            v44[1] = (double)v51 * 5.0 * 2.328306437080797e-10 + v30;
            v29[71] = 1;
            v31 = v44;
            v32 = *v7 + 1;
            v44 += 2;
            v48 = v31[1];
            v33 = v32 >> 1;
            if ( v32 < v7[1] )
            {
              for ( ; v32 > 1; v33 >>= 1 )
              {
                v34 = v7[2];
                if ( *(float *)(*(_DWORD *)(v34 + 4 * v33) + 4) <= (double)v48 )
                  break;
                *(_DWORD *)(v34 + 4 * v32) = *(_DWORD *)(v34 + 4 * v33);
                v32 = v33;
              }
              *(_DWORD *)(v7[2] + 4 * v32) = v31;
              v35 = v7[3];
              ++*v7;
              if ( (unsigned int)v31 > v35 )
                v7[3] = v31;
              if ( (unsigned int)v31 < v7[4] )
                v7[4] = v31;
            }
          }
        }
        v24 = ++v46;
      }
      while ( v46 < 8 );
      if ( *v7 != 0 )
      {
        v36 = v7[2];
        v37 = *(_WORD **)(v36 + 4);
        *(_DWORD *)(v36 + 4) = *(_DWORD *)(v36 + 4 * *v7);
        *(_DWORD *)(v7[2] + 4 * (*v7)--) = 0;
        sub_5AD870(1);
        v39 = v37;
      }
      else
      {
        v39 = nullptr;
      }
      v5 = v40;
      if ( v42 >= a2 )
        break;
      v3 = 25 * a2;
      v17 = v39;
    }
  }
  operator delete(v5);
  if ( v7 != nullptr )
    sub_5AC340(v7, 1);
  return v42;
}
