// 0x594b50 Start_Candidate size=3E6

char sub_594B50()
{
  double v0; // st7
  int v1; // eax
  int v2; // ebx
  int v3; // ebp
  int i; // esi
  int v5; // ebx
  int v6; // edi
  _DWORD *v7; // eax
  int v8; // ecx
  void *v9; // esi
  int j; // edi
  int v11; // esi
  _DWORD *v12; // ebp
  size_t v13; // eax
  signed int k; // edi
  int v15; // eax
  int v16; // eax
  int v17; // edx
  int *v18; // ecx
  int m; // esi
  int v20; // edi
  int v21; // ebx
  int v22; // ebp
  int v23; // esi
  int v24; // edi
  int v25; // eax
  int v26; // edi
  int ii; // esi
  int jj; // esi
  int v30; // [esp+10h] [ebp-54h]
  __int64 n; // [esp+14h] [ebp-50h]
  int v32; // [esp+18h] [ebp-4Ch]
  signed int NumOfElements; // [esp+28h] [ebp-3Ch]
  char v34; // [esp+30h] [ebp-34h]
  _DWORD v35[5]; // [esp+38h] [ebp-2Ch]
  void **v36; // [esp+4Ch] [ebp-18h] BYREF
  void *Block; // [esp+50h] [ebp-14h]
  int v38; // [esp+54h] [ebp-10h]
  char v39; // [esp+59h] [ebp-Bh]
  int v40; // [esp+5Ch] [ebp-8h]
  int v41; // [esp+60h] [ebp-4h]

  v35[0] = 5;
  v35[1] = 5;
  v35[2] = 5;
  v35[3] = 0;
  v35[4] = 0;
  v0 = (double)dword_ABE15C * (double)dword_ABE158 * 0.03;
  if ( v0 < 400.0 )
    v0 = 400.0;
  v32 = sub_7C5F00(v0);
  v1 = sub_56C510(&stru_87F7E8);
  HIWORD(v3) = 0;
  v2 = v35[dword_ABE014];
  LOWORD(v3) = *(_WORD *)(dword_87F800[v2] + 2 * v1);
  sub_58CE90();
  sub_578350(&stru_87F7E8);
  for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
  {
    if ( (unsigned __int8)sub_5AC230(i + 36) != 0
      && *((_DWORD *)dword_ABED10 + 20 * *(__int16 *)(i + 36) + 20 * dword_89C2DC * *(__int16 *)(i + 38) + 14) == -1
      && *(_DWORD *)(i + 76) == 0
      && sub_56D230(i + 36, v2, 0) == v3 )
    {
      sub_594420(v3);
    }
  }
  v5 = dword_ABDFA0;
  v6 = dword_ABDFA0 - 1;
  if ( dword_ABDFA0 - 1 >= 0 )
  {
    v7 = dword_ABDF94;
    do
    {
      v8 = v7[v6];
      if ( *(_DWORD *)(v8 + 12) < v32 )
      {
        v9 = (void *)v7[v6];
        if ( v8 != 0 )
        {
          sub_58C070(v8);
          operator delete(v9);
          v7 = dword_ABDF94;
        }
      }
      --v6;
    }
    while ( v6 >= 0 );
  }
  sub_5AD740(0, 0);
  v36 = (void **)&off_7ED858;
  v41 = 10;
  NumOfElements = 0;
  v34 = 0;
  v40 = 0;
  sub_5AC790(&v36);
  for ( j = 0; j < dword_ABDFA0; ++j )
  {
    v11 = *(_DWORD *)(*((_DWORD *)dword_ABDF94 + j) + 8)
        + v5 * (500000 - *(_DWORD *)(*((_DWORD *)dword_ABDF94 + j) + 12));
    v12 = (char *)dword_ABDF94 + 4 * j;
    if ( NumOfElements + 1 <= 0 || (unsigned __int8)sub_5AD930(10) != 0 )
    {
      *(_DWORD *)(8 * NumOfElements) = v11;
      *(_DWORD *)(8 * NumOfElements + 4) = *v12;
      v34 = 0;
      ++NumOfElements;
    }
  }
  v13 = NumOfElements;
  for ( k = 0; k < NumOfElements; ++k )
  {
    if ( v34 == 0 )
    {
      qsort(nullptr, v13, 8u, sub_5AD9C0);
      v34 = 1;
    }
    if ( v40 < v38
      || (v39 != 0 || v38 == 0)
      && v41 > 0
      && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v36[2])(&v36, v41 + v38, 0) != 0 )
    {
      v15 = v40++;
      *((_DWORD *)Block + v15) = *(_DWORD *)(8 * k + 4);
    }
    v13 = NumOfElements;
  }
  v16 = v40;
  v17 = 0;
  v30 = 0;
  if ( v40 > 0 )
  {
    v18 = (int *)Block;
    for ( m = v40; m != 0; --m )
    {
      v20 = *v18++;
      v17 += *(_DWORD *)(v20 + 12);
    }
    v30 = v17;
  }
  v21 = 0;
  v22 = 0;
  v23 = 0;
  for ( n = (unsigned int)dword_ABE028; v23 < v40; HIDWORD(n) = v22 )
  {
    v24 = *((_DWORD *)Block + v23);
    v21 += *(_DWORD *)(v24 + 12);
    if ( v23 == v16 - 1 )
      v25 = n - v22;
    else
      v25 = sub_7C5F00((double)v21 / (double)v30 * (double)(int)n + 0.5 - (double)SHIDWORD(n));
    *(_DWORD *)(v24 + 32) = v25;
    v22 += v25;
    v16 = v40;
    ++v23;
  }
  v26 = 0;
  for ( ii = 0; ii < v40; ++ii )
  {
    sub_594870(v26);
    v26 += *(_DWORD *)(*((_DWORD *)Block + ii) + 32);
  }
  if ( dword_ABE014 == 0 )
  {
    for ( jj = 0; jj < v40; ++jj )
    {
      if ( *(_DWORD *)(*((_DWORD *)Block + jj) + 32) == 0
        && (double)(unsigned int)sub_65C780(&unk_ABE890) * 2.328306437080797e-10 < 0.5 )
      {
        sub_595400(*((_DWORD **)Block + jj));
      }
    }
  }
  sub_58B820();
  operator delete(nullptr);
  v36 = &VectorClass<MapRegionClass *>::`vftable';
  if ( Block != nullptr && v39 != 0 )
    operator delete(Block);
  return 1;
}
