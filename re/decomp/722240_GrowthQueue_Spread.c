// 0x722240 GrowthQueue_Spread size=149

int sub_722240()
{
  int result; // eax
  int i; // ebp
  int v2; // edi
  _DWORD *v3; // eax
  int j; // ecx
  void **v5; // esi
  int v6; // esi
  void *v7; // eax
  size_t v8; // eax
  _DWORD *v9; // esi
  int v10; // eax
  void *v11; // eax
  int v12; // ecx
  int v13; // eax

  result = dword_B0F4F8;
  for ( i = 0; i < dword_B0F4F8; ++i )
  {
    v2 = *((_DWORD *)dword_B0F4EC + i);
    v3 = *(_DWORD **)(v2 + 244);
    if ( v3 != nullptr )
    {
      for ( j = 0; j <= *v3; *(_DWORD *)(v3[2] + 4 * j - 4) = 0 )
        ++j;
      *v3 = 0;
      v5 = *(void ***)(v2 + 244);
      if ( v5 != nullptr )
      {
        operator delete(v5[2]);
        operator delete(v5);
      }
      *(_DWORD *)(v2 + 244) = 0;
    }
    if ( *(_DWORD *)(v2 + 252) != 0 )
    {
      operator delete(*(void **)(v2 + 252));
      *(_DWORD *)(v2 + 252) = 0;
    }
    if ( *(_DWORD *)(v2 + 248) != 0 )
    {
      operator delete(*(void **)(v2 + 248));
      *(_DWORD *)(v2 + 248) = 0;
    }
    *(_DWORD *)(v2 + 240) = 0;
    v6 = sub_42B1F0();
    v7 = operator new(8 * v6);
    if ( v7 == nullptr )
      v7 = nullptr;
    *(_DWORD *)(v2 + 252) = v7;
    v8 = sub_42B1F0();
    *(_DWORD *)(v2 + 248) = operator new(v8);
    v9 = operator new(0x14u);
    if ( v9 != nullptr )
    {
      v10 = sub_42B1F0();
      v9[3] = 0;
      v9[4] = -1;
      *v9 = 0;
      v9[1] = v10;
      v11 = operator new(4 * v10 + 4);
      v12 = v9[1];
      v9[2] = v11;
      v13 = 0;
      if ( v12 >= 0 )
      {
        do
        {
          ++v13;
          *(_DWORD *)(v9[2] + 4 * v13 - 4) = 0;
        }
        while ( v13 <= v9[1] );
      }
    }
    else
    {
      v9 = nullptr;
    }
    *(_DWORD *)(v2 + 244) = v9;
    sub_7228B0(v2);
    result = dword_B0F4F8;
  }
  return result;
}
