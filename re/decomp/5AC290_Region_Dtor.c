// 0x5ac290 Region_Dtor size=A7

_DWORD *__thiscall sub_5AC290(_DWORD *Block, char a2)
{
  void (__thiscall ***v3)(_DWORD, int); // ecx
  int v4; // eax
  void *v5; // eax
  _DWORD *v7; // [esp+4h] [ebp-4h] BYREF

  v3 = (void (__thiscall ***)(_DWORD, int))*Block;
  if ( v3 != nullptr )
  {
    (**v3)(v3, 1);
    *Block = 0;
  }
  v7 = Block;
  v4 = (*(int (__thiscall **)(int *, _DWORD **))(dword_ABDF90 + 16))(&dword_ABDF90, &v7);
  if ( v4 != -1 && v4 < dword_ABDFA0 && v4 < --dword_ABDFA0 )
  {
    do
    {
      ++v4;
      *((_DWORD *)dword_ABDF94 + v4 - 1) = *((_DWORD *)dword_ABDF94 + v4);
    }
    while ( v4 < dword_ABDFA0 );
  }
  v5 = (void *)*(Block + 11);
  *(Block + 10) = &VectorClass<Cell>::`vftable';
  if ( v5 != nullptr && *((_BYTE *)Block + 53) != 0 )
  {
    operator delete(v5);
    *(Block + 11) = 0;
  }
  *((_BYTE *)Block + 53) = 0;
  *(Block + 12) = 0;
  if ( (a2 & 1) != 0 )
    operator delete(Block);
  return Block;
}
