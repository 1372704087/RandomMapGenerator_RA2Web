// 0x59a8f0 Water_PartitionGridDraws size=41B

void __stdcall sub_59A8F0(int a1, int a2, int *a3)
{
  double v3; // st7
  int v4; // eax
  int v5; // ebx
  int v6; // esi
  int *v7; // ebp
  int v8; // esi
  int v9; // edi
  int v10; // ecx
  int v11; // eax
  int v12; // eax
  int i; // edi
  unsigned int v14; // esi
  int v15; // eax
  int v16; // edi
  int v17; // ecx
  int v18; // eax
  int v19; // ecx
  int v20; // eax
  _DWORD *v21; // edx
  bool v22; // zf
  int v23; // [esp+18h] [ebp-74h]
  int v24; // [esp+1Ch] [ebp-70h]
  __int64 v25; // [esp+20h] [ebp-6Ch]
  int v26; // [esp+28h] [ebp-64h]
  int v27; // [esp+2Ch] [ebp-60h]
  int v28; // [esp+30h] [ebp-5Ch]
  int v29; // [esp+38h] [ebp-54h]
  int v30; // [esp+3Ch] [ebp-50h]
  int v31; // [esp+40h] [ebp-4Ch]
  int k; // [esp+40h] [ebp-4Ch]
  int v33; // [esp+44h] [ebp-48h]
  int v34; // [esp+48h] [ebp-44h]
  __int64 v35; // [esp+4Ch] [ebp-40h]
  double v36; // [esp+54h] [ebp-38h]
  void **v37; // [esp+5Ch] [ebp-30h] BYREF
  void *Block; // [esp+60h] [ebp-2Ch]
  int v39; // [esp+64h] [ebp-28h]
  int v40; // [esp+68h] [ebp-24h]
  int j; // [esp+6Ch] [ebp-20h]
  int v42; // [esp+70h] [ebp-1Ch]
  void **v43; // [esp+74h] [ebp-18h] BYREF
  void *v44; // [esp+78h] [ebp-14h]
  int v45; // [esp+7Ch] [ebp-10h]
  char v46; // [esp+81h] [ebp-Bh]
  int v47; // [esp+84h] [ebp-8h]
  int v48; // [esp+88h] [ebp-4h]

  v3 = (double)a2;
  sub_4CAC40(v3);
  v4 = sub_7C5F00(v3);
  v31 = v4;
  if ( v4 * v4 == a2 )
  {
    v5 = v4;
    v26 = v4;
  }
  else
  {
    v26 = v4 + 1;
    v5 = v4 + 1;
  }
  if ( v4 * v5 < a2 )
  {
    v23 = v5;
    v6 = v5;
  }
  else
  {
    v6 = v4;
    v23 = v4;
  }
  v7 = a3;
  v24 = a3[2] / v5;
  v25 = (unsigned int)(a3[3] / v5);
  v29 = 0;
  v30 = 0;
  v27 = 0;
  if ( (double)(unsigned int)sub_65C780(&unk_ABE890) * 2.328306437080797e-10 >= 0.5 )
  {
    HIDWORD(v25) = v24;
    LODWORD(v25) = a3[3] / v6;
    v30 = v25;
  }
  else
  {
    v27 = v25;
    v24 = a3[2] / v6;
    v29 = v24;
  }
  v8 = v5 * v6 - a2;
  v9 = 0;
  v34 = a3[1];
  v33 = *a3;
  sub_477BE0(0, 0);
  v43 = &DynamicVectorClass<int>::`vftable';
  v48 = 10;
  v47 = 0;
  sub_477BE0(0, 0);
  v10 = 0;
  v37 = &DynamicVectorClass<int>::`vftable';
  v42 = 10;
  j = 0;
  if ( v23 > 0 )
  {
    do
    {
      if ( v47 < v45
        || (v46 != 0 || v45 == 0)
        && v48 > 0
        && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v43[2])(&v43, v48 + v45, 0) != 0 )
      {
        v11 = v47++;
        *((_DWORD *)v44 + v11) = v5;
      }
      if ( j < v39
        || (BYTE1(v40) != 0 || v39 == 0)
        && v42 > 0
        && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v37[2])(&v37, v42 + v39, 0) != 0 )
      {
        v12 = j++;
        *((_DWORD *)Block + v12) = v9;
      }
      ++v9;
    }
    while ( v9 < v23 );
    v10 = j;
  }
  if ( v8 > 0 )
  {
    for ( i = v8; i != 0; --i )
    {
      v14 = v10 - 1;
      v36 = (double)(unsigned int)v10;
      do
      {
        v35 = (unsigned int)sub_65C780(&unk_ABE890);
        v15 = sub_7C5F00((double)v35 * v36 * 2.328306437080797e-10);
      }
      while ( v15 > v14 );
      *((_DWORD *)v44 + *((_DWORD *)Block + v15)) = v31;
      v10 = j;
      if ( v15 < j )
      {
        v10 = j - 1;
        for ( j = v10; v15 < j; v10 = j )
        {
          ++v15;
          *((_DWORD *)Block + v15 - 1) = *((_DWORD *)Block + v15);
        }
      }
    }
  }
  v16 = 0;
  for ( k = 0; v16 < v23; k = v16 )
  {
    v17 = *((_DWORD *)v44 + v16);
    if ( v17 < v5 )
    {
      if ( SHIDWORD(v25) <= 0 )
        v34 += (int)v25 / 2;
      else
        v33 += v24 / 2;
    }
    if ( v17 > 0 )
    {
      v28 = *((_DWORD *)v44 + v16);
      do
      {
        v18 = *(_DWORD *)(a1 + 8);
        if ( *(_DWORD *)(a1 + 16) < v18
          || (*(_BYTE *)(a1 + 13) != 0 || v18 == 0)
          && (v19 = *(_DWORD *)(a1 + 20)) > 0
          && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)a1 + 8))(a1, v18 + v19, 0) != 0 )
        {
          v20 = *(_DWORD *)(a1 + 16);
          *(_DWORD *)(a1 + 16) = v20 + 1;
          v21 = (_DWORD *)(*(_DWORD *)(a1 + 4) + 16 * v20);
          *v21 = v33 + 2;
          v21[1] = v34 + 2;
          v21[2] = v24 - 4;
          v21[3] = v25 - 4;
        }
        v33 += HIDWORD(v25);
        v22 = v28 == 1;
        v34 += v27;
        --v28;
      }
      while ( !v22 );
      v5 = v26;
      v7 = a3;
      v16 = k;
    }
    v33 += v29;
    v34 += v30;
    if ( SHIDWORD(v25) <= 0 )
      v34 = v7[1];
    else
      v33 = *v7;
    ++v16;
  }
  v37 = &VectorClass<int>::`vftable';
  if ( Block != nullptr && BYTE1(v40) != 0 )
  {
    operator delete(Block);
    Block = nullptr;
  }
  v43 = &VectorClass<int>::`vftable';
  BYTE1(v40) = 0;
  v39 = 0;
  if ( v44 != nullptr && v46 != 0 )
    operator delete(v44);
}
