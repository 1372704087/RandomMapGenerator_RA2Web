// 0x58ce90 Region_ResetAll size=F3

void sub_58CE90()
{
  int v0; // ecx
  int v1; // eax
  int i; // edi
  _DWORD *v3; // esi
  int v4; // eax
  void *v5; // eax
  _DWORD *v6; // [esp+Ch] [ebp-4h] BYREF

  if ( dword_ABED10 != nullptr )
  {
    v0 = dword_89C2DC * dword_89C2DC;
    if ( dword_89C2DC * dword_89C2DC > 0 )
    {
      v1 = 0;
      do
      {
        *(_DWORD *)((char *)dword_ABED10 + v1 + 56) = -1;
        *(_DWORD *)((char *)dword_ABED10 + v1 + 60) = -1;
        v1 += 80;
        --v0;
      }
      while ( v0 != 0 );
    }
  }
  for ( i = dword_ABDFA0 - 1; i >= 0; --i )
  {
    v3 = *((_DWORD **)dword_ABDF94 + i);
    if ( v3 != nullptr )
    {
      if ( *v3 != 0 )
      {
        (**(void (__thiscall ***)(_DWORD, int))*v3)(*v3, 1);
        *v3 = 0;
      }
      v6 = v3;
      v4 = (*(int (__thiscall **)(int *, _DWORD **))(dword_ABDF90 + 16))(&dword_ABDF90, &v6);
      if ( v4 != -1 && v4 < dword_ABDFA0 && v4 < --dword_ABDFA0 )
      {
        do
        {
          ++v4;
          *((_DWORD *)dword_ABDF94 + v4 - 1) = *((_DWORD *)dword_ABDF94 + v4);
        }
        while ( v4 < dword_ABDFA0 );
      }
      v5 = (void *)v3[11];
      v3[10] = &VectorClass<Cell>::`vftable';
      if ( v5 != nullptr && *((_BYTE *)v3 + 53) != 0 )
      {
        operator delete(v5);
        v3[11] = 0;
      }
      *((_BYTE *)v3 + 53) = 0;
      v3[12] = 0;
      operator delete(v3);
    }
  }
  dword_ABED14 = 0;
}
