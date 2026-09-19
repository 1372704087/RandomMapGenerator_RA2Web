// 0x58ef10 Bridge_ConnectPass size=1A5

char sub_58EF10()
{
  int i; // eax
  int v1; // ecx
  int v2; // eax
  int v3; // ecx
  int v4; // edi
  void *v5; // esi
  int v6; // esi
  int v7; // edi
  int v8; // eax
  int v9; // eax
  int v10; // esi
  int v11; // esi
  int v12; // esi
  void (__thiscall ***v13)(_DWORD, int); // ecx
  char v15; // [esp+Fh] [ebp-5h]
  _WORD v16[2]; // [esp+10h] [ebp-4h] BYREF

  v15 = 1;
  sub_4A8BF0(0);
  sub_578350(&stru_87F7E8);
  for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
  {
    if ( v15 == 0 )
      break;
    v15 = sub_579010(i, -1);
  }
  if ( dword_ABED10 != nullptr )
  {
    v1 = dword_89C2DC * dword_89C2DC;
    if ( dword_89C2DC * dword_89C2DC > 0 )
    {
      v2 = 0;
      do
      {
        v2 += 80;
        --v1;
        *(_DWORD *)((char *)dword_ABED10 + v2 - 24) = -1;
        *(_DWORD *)((char *)dword_ABED10 + v2 - 20) = -1;
      }
      while ( v1 != 0 );
    }
  }
  v3 = dword_ABDFA0;
  v4 = dword_ABDFA0 - 1;
  if ( dword_ABDFA0 - 1 >= 0 )
  {
    do
    {
      v5 = *((void **)dword_ABDF94 + v4);
      if ( v5 != nullptr )
      {
        sub_58C070(*((_DWORD *)dword_ABDF94 + v4));
        operator delete(v5);
      }
      --v4;
    }
    while ( v4 >= 0 );
    v3 = dword_ABDFA0;
  }
  dword_ABED14 = 0;
  if ( dword_89C2DC * dword_89C2DC > 0 )
  {
    v6 = 0;
    v7 = dword_89C2DC * dword_89C2DC;
    do
    {
      if ( *(_DWORD *)((char *)dword_ABED10 + v6 + 56) == -1 )
      {
        v16[0] = 0;
        v16[1] = 0;
        if ( (unsigned __int8)sub_5AC370(v16) != 0 )
        {
          v8 = sub_5657A0((char *)dword_ABED10 + v6);
          v9 = sub_58C800(v8);
          if ( v9 != 0 )
            *(_BYTE *)(v9 + 26) = 0;
        }
      }
      v6 += 80;
      --v7;
    }
    while ( v7 != 0 );
    v3 = dword_ABDFA0;
  }
  if ( v15 != 0 )
  {
    v10 = 0;
    if ( v3 > 0 )
    {
      do
      {
        sub_58F0C0(*((_DWORD **)dword_ABDF94 + v10));
        v3 = dword_ABDFA0;
        ++v10;
      }
      while ( v10 < dword_ABDFA0 );
    }
    v11 = 0;
    if ( v3 > 0 )
    {
      do
      {
        sub_5905D0(*((_DWORD *)dword_ABDF94 + v11));
        v3 = dword_ABDFA0;
        ++v11;
      }
      while ( v11 < dword_ABDFA0 );
    }
    v12 = 0;
    if ( v3 > 0 )
    {
      do
      {
        v13 = *(void (__thiscall ****)(_DWORD, int))(*((_DWORD *)dword_ABDF94 + v12) + 4);
        if ( v13 != nullptr )
          (**v13)(v13, 1);
        *(_DWORD *)(*((_DWORD *)dword_ABDF94 + v12++) + 4) = 0;
      }
      while ( v12 < dword_ABDFA0 );
    }
  }
  return 1;
}
