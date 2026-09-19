// 0x58d410 Region_BoundaryCells size=18A

_DWORD *__thiscall sub_58D410(_DWORD *this)
{
  _DWORD *v1; // esi
  _DWORD *v2; // ebx
  _DWORD *v3; // ebp
  int v4; // ecx
  int v5; // eax
  signed int i; // edi
  int v7; // edx
  int v8; // eax
  int v9; // eax
  int v10; // ebp
  int v11; // ecx
  int v12; // eax
  int v13; // edx
  char v15; // [esp+Fh] [ebp-Dh]
  _DWORD *v16; // [esp+10h] [ebp-Ch]
  int v18; // [esp+18h] [ebp-4h]

  v1 = operator new(0x18u);
  if ( v1 != nullptr )
  {
    sub_42FCB0(0, 0);
    *v1 = &DynamicVectorClass<Cell>::`vftable';
    v1[5] = 10;
    v1[4] = 0;
    v2 = v1;
  }
  else
  {
    v2 = nullptr;
  }
  v16 = v2;
  sub_578350(&stru_87F7E8);
  v3 = (_DWORD *)sub_578290(&stru_87F7E8);
  if ( v3 == nullptr )
    return v2;
  do
  {
    v4 = v3[9];
    if ( dword_ABED10 != nullptr )
      v5 = *((_DWORD *)dword_ABED10 + 20 * (__int16)v4 + 20 * dword_89C2DC * SHIWORD(v4) + 14);
    else
      v5 = -1;
    if ( v5 == *(this + 2) )
    {
      v15 = 0;
      for ( i = 0; i < 8; ++i )
      {
        v18 = sub_481810(v3, i)[9];
        v7 = SHIWORD(v18) + (__int16)v18;
        if ( v7 > dword_ABED04 )
        {
          if ( (__int16)v18 - SHIWORD(v18) < dword_ABED04
            && SHIWORD(v18) - (__int16)v18 < dword_ABED04
            && v7 <= dword_ABED08 )
          {
            v8 = dword_ABED10 != nullptr
               ? *((_DWORD *)dword_ABED10 + 20 * (__int16)v18 + 20 * dword_89C2DC * SHIWORD(v18) + 14)
               : -1;
            if ( v8 != *(this + 2) )
              v15 = 1;
          }
          v2 = v16;
        }
      }
      if ( v15 != 0 )
      {
        v9 = v2[2];
        v10 = v3[9];
        if ( v2[4] < v9
          || (*((_BYTE *)v2 + 13) != 0 || v9 == 0)
          && (v11 = v2[5]) > 0
          && (*(unsigned __int8 (__thiscall **)(_DWORD *, int, _DWORD))(*v2 + 8))(v2, v9 + v11, 0) != 0 )
        {
          v12 = v2[4];
          v13 = v2[1];
          v2[4] = v12 + 1;
          *(_DWORD *)(v13 + 4 * v12) = v10;
        }
      }
    }
    v3 = (_DWORD *)sub_578290(&stru_87F7E8);
  }
  while ( v3 != nullptr );
  return v2;
}
