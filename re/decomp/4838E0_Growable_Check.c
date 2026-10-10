char __thiscall sub_4838E0(int this, int a2)
{
  _DWORD *v3; // esi
  int v4; // esi
  _DWORD *v5; // esi
  int v6; // eax

  if ( (unsigned __int8)sub_578460(this + 36, 1) != 0 && (*(_DWORD *)(this + 320) & 0x500) == 0 )
  {
    if ( unk_A8E9D0 == 0 )
      goto LABEL_17;
    v3 = *(_DWORD **)(this + 228);
    if ( v3 != nullptr )
    {
      while ( (*(int (__thiscall **)(_DWORD *))(*v3 + 44))(v3) != 6 )
      {
        v3 = (_DWORD *)v3[12];
        if ( v3 == nullptr )
          goto LABEL_11;
      }
      if ( (int)v3[27] > 0 )
      {
        v4 = v3[328];
        if ( *(_BYTE *)(v4 + 3226) == 0 && *(_BYTE *)(v4 + 5889) == 0 )
          return 0;
      }
    }
LABEL_11:
    if ( unk_A8E9D0 == 0 )
      goto LABEL_17;
    v5 = *(_DWORD **)(this + 228);
    if ( v5 == nullptr )
      goto LABEL_17;
    while ( (*(int (__thiscall **)(_DWORD *))(*v5 + 44))(v5) != 36 )
    {
      v5 = (_DWORD *)v5[12];
      if ( v5 == nullptr )
        goto LABEL_17;
    }
    if ( *(_BYTE *)(v5[50] + 689) == 0 )
    {
LABEL_17:
      if ( byte_89EA90[36 * *(_DWORD *)(this + 236)] != 0 && *(_DWORD *)(this + 68) == -1 && *(_BYTE *)(this + 284) == 0 )
      {
        v6 = *(_DWORD *)(this + 56);
        if ( v6 < 0 || v6 >= unk_A8ED68 || *(_BYTE *)(*(_DWORD *)(*(_DWORD *)&byte_A8ED5C + 4 * v6) + 774) != 0 )
          return 1;
      }
    }
  }
  return 0;
}
