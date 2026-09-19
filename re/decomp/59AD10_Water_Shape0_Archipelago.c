// 0x59ad10 Water_Shape0_Archipelago size=285

void __thiscall sub_59AD10(_DWORD *this)
{
  int v2; // eax
  int v3; // eax
  unsigned int v4; // esi
  unsigned int v5; // eax
  int v6; // edx
  int i; // eax
  int v8; // eax
  int v9; // esi
  int v10; // edi
  int v11; // ebp
  int v12; // esi
  int v13; // eax
  int v14; // ecx
  int v15; // eax
  _DWORD *v16; // esi
  _DWORD *v17; // edx
  int v18; // [esp+10h] [ebp-50h] BYREF
  int v19; // [esp+14h] [ebp-4Ch]
  int v20[2]; // [esp+18h] [ebp-48h] BYREF
  double v21; // [esp+20h] [ebp-40h]
  int v22; // [esp+28h] [ebp-38h] BYREF
  int v23; // [esp+2Ch] [ebp-34h]
  int v24; // [esp+30h] [ebp-30h]
  int v25; // [esp+34h] [ebp-2Ch]
  int v26[4]; // [esp+38h] [ebp-28h] BYREF
  void **v27; // [esp+48h] [ebp-18h] BYREF
  void *Block; // [esp+4Ch] [ebp-14h]
  char v29; // [esp+55h] [ebp-Bh]
  int v30; // [esp+58h] [ebp-8h]
  int v31; // [esp+5Ch] [ebp-4h]

  *(this + 194) = 1;
  sub_5ADA40(0, 0);
  v2 = *(this + 20);
  v27 = &DynamicVectorClass<TRect<int>>::`vftable';
  v31 = 10;
  v3 = v2 / 2;
  v30 = 0;
  v4 = 2;
  if ( v3 >= 2 )
    v4 = v3;
  *(_QWORD *)v20 = v4;
  v21 = (double)v4;
  do
  {
    *(_QWORD *)v20 = (unsigned int)sub_65C780(&unk_ABE890);
    v5 = sub_7C5F00((double)*(__int64 *)v20 * v21 * 2.328306437080797e-10 + 1.0);
  }
  while ( v5 > v4 );
  v26[1] = dword_87F8E8;
  v26[0] = dword_87F8E4;
  v26[3] = dword_87F8F0;
  v6 = *(this + 20);
  v26[2] = dword_87F8EC;
  sub_59A8F0((int)&v27, v5 + v6, v26);
  sub_578350(&stru_87F7E8);
  for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
  {
    v18 = *(_DWORD *)(i + 36);
    *((_DWORD *)dword_ABED10 + 20 * (__int16)v18 + 20 * dword_89C2DC * SHIWORD(v18) + 15) = 0;
  }
  while ( v30 > 0 )
  {
    v22 = *(_DWORD *)Block;
    v23 = *((_DWORD *)Block + 1);
    v24 = *((_DWORD *)Block + 2);
    v25 = *((_DWORD *)Block + 3);
    v8 = sub_65C780(&unk_ABE890);
    v9 = v25;
    v10 = v24;
    *(_QWORD *)&v21 = (unsigned int)v8;
    v19 = 2 * v24 * v25;
    v11 = sub_7C5F00(((double)(unsigned int)v8 * 2.328306437080797e-10 * 0.05 + 0.45) * (double)v19);
    v20[0] = v22 + v10 / 2 + v9 / 2 + v23 + 1;
    v20[1] = v23 + dword_87F8DC + v9 / 2 - v10 / 2 - v22;
    v12 = 0;
    do
    {
      if ( v12 >= 10 )
        break;
      LOWORD(v18) = v20[0];
      HIWORD(v18) = v20[1];
      v13 = sub_59BBC0(this, v11, &v22, (int)v20, 1, (int)&v18, 0.25, 0);
      if ( v13 == 0 )
        ++*(this + 194);
      ++v12;
    }
    while ( v13 == 0 );
    if ( v30 <= 0 )
      break;
    v14 = 0;
    if ( --v30 <= 0 )
      break;
    v15 = 0;
    do
    {
      v16 = (char *)Block + v15 + 16;
      v17 = (char *)Block + v15;
      ++v14;
      v15 += 16;
      *v17 = *v16;
      v17[1] = v16[1];
      v17[2] = v16[2];
      v17[3] = v16[3];
    }
    while ( v14 < v30 );
  }
  v27 = &VectorClass<TRect<int>>::`vftable';
  if ( Block != nullptr && v29 != 0 )
    operator delete(Block);
}
