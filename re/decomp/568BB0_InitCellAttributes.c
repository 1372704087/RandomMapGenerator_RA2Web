// 0x568bb0 InitCellAttributes size=289

int __thiscall sub_568BB0(_DWORD *this, char a2)
{
  int v2; // esi
  _DWORD *v4; // eax
  _BYTE *v5; // ecx
  int v6; // eax
  int i; // eax
  int v8; // eax
  int j; // esi
  int v10; // eax
  int k; // edx
  unsigned int v12; // eax
  _DWORD *v13; // eax
  int m; // edx
  unsigned int v15; // eax
  _DWORD *v16; // eax
  int v17; // eax
  int v18; // eax
  int v20; // [esp+Ch] [ebp-Ch]
  int v21; // [esp+10h] [ebp-8h]
  int v22; // [esp+14h] [ebp-4h]

  v2 = 0;
  v20 = 0;
  if ( dword_A8E9B8 > 0 )
  {
    v4 = dword_A8E9AC;
    do
    {
      v5 = (_BYTE *)v4[v2];
      if ( v5[407] != 0 )
      {
        if ( v5 != nullptr )
        {
          (*(void (__thiscall **)(_BYTE *, int))(*(_DWORD *)v5 + 32))(v5, 1);
          v4 = dword_A8E9AC;
        }
        --v2;
      }
      ++v2;
    }
    while ( v2 < dword_A8E9B8 );
  }
  v6 = *(this + 61);
  *(this + 67) = 1;
  *(this + 68) = v6;
  *(this + 69) = v6 - 1;
  *(this + 70) = (v6 << 11) + *(this + 79) + 4;
  for ( i = sub_578290(this); i != 0; i = sub_578290(this) )
    *(_DWORD *)(i + 320) &= 0xFFCFFFFF;
  v8 = *(this + 61);
  *(this + 67) = 1;
  *(this + 68) = v8;
  *(this + 69) = v8 - 1;
  *(this + 70) = (v8 << 11) + *(this + 79) + 4;
  for ( j = sub_578290(this); j != 0; j = sub_578290(this) )
  {
    *(_DWORD *)(j + 48) = 0;
    sub_483E30(0, 0x10000, 0, 1000, 1000, 1000);
    v10 = *(_DWORD *)(j + 60);
    *(_DWORD *)(j + 320) &= ~0x20000u;
    if ( v10 != 0 )
    {
      if ( (unsigned __int8)sub_6E5320(v10) != 0 )
      {
        for ( k = 0; k < dword_87F914; v13[80] |= 0x100000u )
        {
          HIWORD(v21) = *(_WORD *)(j + 38);
          LOWORD(v21) = k + *(this + 73);
          v12 = (__int16)v21 + (SHIWORD(v21) << 9);
          if ( v12 >= 0x40000 || (v13 = *(_DWORD **)(dword_87F924 + 4 * v12)) == nullptr )
          {
            dword_ABDC74 = v21;
            v13 = &unk_ABDC50;
          }
          ++k;
        }
      }
      else if ( (unsigned __int8)sub_6E5300(*(_DWORD *)(j + 60)) != 0 )
      {
        for ( m = 0; m < dword_87F918; v16[80] |= 0x200000u )
        {
          LOWORD(v22) = *(_WORD *)(j + 36);
          HIWORD(v22) = m + *(this + 74);
          v15 = (__int16)v22 + (SHIWORD(v22) << 9);
          if ( v15 >= 0x40000 || (v16 = *(_DWORD **)(dword_87F924 + 4 * v15)) == nullptr )
          {
            dword_ABDC74 = v22;
            v16 = &unk_ABDC50;
          }
          ++m;
        }
      }
    }
    if ( a2 != 0 )
      v17 = sub_4818E0(0);
    else
      v17 = sub_485020(j);
    v20 += v17;
    sub_47D2B0(j, -1);
    v18 = *(_DWORD *)(j + 68);
    if ( v18 != -1 && *(_BYTE *)(*((_DWORD *)dword_A83D84 + v18) + 680) != 0 )
      sub_47D210(j);
  }
  return v20;
}
