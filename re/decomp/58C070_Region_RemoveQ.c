// 0x58c070 Region_RemoveQ size=87

void __thiscall sub_58C070(_DWORD *this)
{
  void (__thiscall ***v2)(_DWORD, int); // ecx
  int v3; // eax
  void *v4; // eax
  _DWORD *v5; // [esp+8h] [ebp-4h] BYREF

  v2 = (void (__thiscall ***)(_DWORD, int))*this;
  if ( v2 != nullptr )
  {
    (**v2)(v2, 1);
    *this = 0;
  }
  v5 = this;
  v3 = (*(int (__thiscall **)(int *, _DWORD **))(dword_ABDF90 + 16))(&dword_ABDF90, &v5);
  if ( v3 != -1 && v3 < dword_ABDFA0 && v3 < --dword_ABDFA0 )
  {
    do
    {
      ++v3;
      *((_DWORD *)dword_ABDF94 + v3 - 1) = *((_DWORD *)dword_ABDF94 + v3);
    }
    while ( v3 < dword_ABDFA0 );
  }
  v4 = (void *)*(this + 11);
  *(this + 10) = &VectorClass<Cell>::`vftable';
  if ( v4 != nullptr && *((_BYTE *)this + 53) != 0 )
  {
    operator delete(v4);
    *(this + 11) = 0;
  }
  *((_BYTE *)this + 53) = 0;
  *(this + 12) = 0;
}
