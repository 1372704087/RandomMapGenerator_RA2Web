int __thiscall sub_485130(int *this, int a2)
{
  int v3; // edi
  int v4; // eax
  int v5; // eax
  int result; // eax
  _DWORD *v7; // esi
  int v8; // ecx
  int v9; // ecx

  v3 = a2;
  v4 = *(this + 15);
  if ( v4 == a2 )
  {
    if ( v4 != 0 )
      --*(_DWORD *)(v4 + 44);
    *(this + 15) = 0;
    v5 = (*(int (__thiscall **)(int *, int *))(dword_880974 + 16))(&dword_880944, this + 9);
    if ( v5 != -1 && v5 < unk_880984 )
    {
      --unk_880984;
      for ( ; v5 < unk_880984; *(_DWORD *)(dword_880978 + 4 * v5 - 4) = *(_DWORD *)(dword_880978 + 4 * v5) )
        ++v5;
    }
  }
  if ( *(this + 11) == v3 )
    *(this + 11) = 0;
  if ( *(this + 12) == v3 )
    *(this + 12) = 0;
  result = *(this + 10);
  if ( result != 0 )
  {
    result = (*(int (__thiscall **)(int))(*(_DWORD *)v3 + 44))(v3);
    if ( result == 61 )
    {
      v7 = (_DWORD *)*(this + 10);
      a2 = v3;
      result = (*(int (__thiscall **)(_DWORD *, int *))(*v7 + 16))(v7, &a2);
      if ( result != -1 )
      {
        v8 = v7[4];
        if ( result < v8 )
        {
          v9 = v8 - 1;
          for ( v7[4] = v9; result < v7[4]; *(_DWORD *)(v7[1] + 4 * result - 4) = *(_DWORD *)(v7[1] + 4 * result) )
            ++result;
        }
      }
    }
  }
  return result;
}
