// 0x594870 Start_WritePerRegion size=2E0

void __thiscall sub_594870(int *this, int a2)
{
  unsigned int v3; // eax
  int v4; // ecx
  int i; // edi
  unsigned int v6; // esi
  unsigned int v7; // eax
  int v8; // eax
  _DWORD *v9; // edi
  int j; // eax
  int v11; // esi
  int v12; // ebp
  __int16 *v13; // eax
  _DWORD *v14; // eax
  int k; // edx
  int v16; // eax
  int v17; // ecx
  int v18; // eax
  void *v19; // eax
  int v20; // [esp+10h] [ebp-5Ch] BYREF
  __int64 v21; // [esp+14h] [ebp-58h]
  __int64 v22; // [esp+1Ch] [ebp-50h]
  __int64 v23; // [esp+24h] [ebp-48h]
  double v24; // [esp+2Ch] [ebp-40h]
  int v25; // [esp+34h] [ebp-38h]
  int v26; // [esp+38h] [ebp-34h]
  int v27; // [esp+3Ch] [ebp-30h]
  int v28; // [esp+40h] [ebp-2Ch]
  _DWORD v29[4]; // [esp+44h] [ebp-28h] BYREF
  void **v30; // [esp+54h] [ebp-18h] BYREF
  void *Block; // [esp+58h] [ebp-14h]
  int v32; // [esp+5Ch] [ebp-10h]
  char v33; // [esp+61h] [ebp-Bh]
  int v34; // [esp+64h] [ebp-8h]
  int v35; // [esp+68h] [ebp-4h]

  v29[1] = dword_87F8E8 + 4;
  v29[0] = dword_87F8E4 + 4;
  v29[2] = dword_87F8EC - 8;
  v29[3] = dword_87F8F0 - 8;
  sub_42FCB0(0, 0);
  v30 = &DynamicVectorClass<Cell>::`vftable';
  v35 = 10;
  v34 = 0;
  do
  {
    v21 = (unsigned int)sub_65C780(&unk_ABE890);
    v3 = sub_7C5F00((double)v21 * 6.984919311242392e-10);
  }
  while ( v3 > 2 );
  v4 = *(this + 8);
  LODWORD(v21) = 0;
  for ( i = v3 + 12 * v4 + 3 * v4; v34 < i; LODWORD(v21) = v21 + 1 )
  {
    if ( (int)v21 >= 300 )
      break;
    v6 = *(this + 14) - 1;
    v22 = (unsigned int)*(this + 14);
    v24 = (double)v22;
    do
    {
      v23 = (unsigned int)sub_65C780(&unk_ABE890);
      v7 = sub_7C5F00((double)v23 * v24 * 2.328306437080797e-10);
    }
    while ( v7 > v6 );
    v20 = *(_DWORD *)(*(this + 11) + 4 * v7);
    v25 = (__int16)v20 - 3;
    v26 = SHIWORD(v20) - 3;
    v27 = 6;
    v28 = 6;
    if ( (unsigned __int8)sub_5A7250(0) != 0
      && (unsigned __int8)sub_578640(v29, &v20, 1) != 0
      && (v34 < v32
       || (v33 != 0 || v32 == 0)
       && v35 > 0
       && ((unsigned __int8 (__thiscall *)(void ***, int, _DWORD))v30[2])(&v30, v35 + v32, 0) != 0) )
    {
      v8 = v34++;
      *((_DWORD *)Block + v8) = v20;
    }
  }
  v9 = sub_594F40(this, (int)&v30);
  if ( v9 != nullptr )
  {
    for ( j = 4544; j < 4576; j += 4 )
      *(_DWORD *)((char *)dword_A8B230 + j) = dword_ABE300;
    v11 = 0;
    if ( *(this + 8) > 0 )
    {
      v12 = a2;
      do
      {
        sub_68BF50((char *)dword_A8B230, v12, *(_DWORD *)(v9[1] + 4 * v11));
        v13 = (__int16 *)sub_68BCC0((char *)dword_A8B230, &a2, v12);
        v14 = sub_5657A0(&stru_87F7E8, v13);
        ++v11;
        v14[80] |= 4u;
        ++v12;
        *((_DWORD *)dword_A8B230 + v11 + 1135) = *(_DWORD *)(v9[1] + 4 * v11 - 4);
      }
      while ( v11 < *(this + 8) );
    }
    for ( k = 0; k < *(this + 8); ++k )
    {
      v16 = v9[4];
      if ( v16 > 0 )
      {
        v17 = v16 - 1;
        v18 = 0;
        for ( v9[4] = v17; v18 < v9[4]; *(_DWORD *)(v9[1] + 4 * v18 - 4) = *(_DWORD *)(v9[1] + 4 * v18) )
          ++v18;
      }
    }
    if ( *this != 0 )
      (**(void (__thiscall ***)(int, int))*this)(*this, 1);
    v19 = Block;
    *this = (int)v9;
    v30 = &VectorClass<Cell>::`vftable';
    if ( v19 != nullptr && v33 != 0 )
      operator delete(v19);
  }
  else
  {
    v30 = &VectorClass<Cell>::`vftable';
    if ( Block != nullptr && v33 != 0 )
      operator delete(Block);
  }
}
