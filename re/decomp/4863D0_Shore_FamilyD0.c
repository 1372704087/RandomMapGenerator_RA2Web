bool __thiscall sub_4863D0(int this)
{
  int v1; // eax
  int v3; // eax
  char v4; // cl
  int v5; // eax
  char v6; // cl
  int v7; // eax
  int v8; // eax
  char v9; // cl
  int v10; // eax
  int v11; // eax
  int v12; // eax
  int v13; // eax
  int v14; // eax
  int v15; // ecx

  if ( dword_AA1020 != -1 )
  {
    v1 = *(_DWORD *)(this + 56);
    if ( v1 >= dword_AA1020 && v1 < dword_AA1020 + 40 )
      return true;
  }
  if ( dword_AA073C == -1 || (v3 = *(_DWORD *)(this + 56)) < dword_AA073C || v3 >= dword_AA073C + 4 )
  {
    if ( dword_ABB110 == -1 || (v5 = *(_DWORD *)(this + 56)) < dword_ABB110 || v5 >= dword_ABB110 + 4 )
    {
      if ( dword_AA1050 == -1 || (v7 = *(_DWORD *)(this + 56)) < dword_AA1050 || v7 >= dword_AA1050 + 4 )
      {
        if ( dword_AA10A0 == -1 || (v8 = *(_DWORD *)(this + 56)) < dword_AA10A0 || v8 >= dword_AA10A0 + 4 )
        {
          if ( dword_ABBEBC != -1 )
          {
            v10 = *(_DWORD *)(this + 56);
            if ( v10 >= dword_ABBEBC && v10 < dword_ABBEBC + 20 )
              return true;
          }
          if ( dword_ABAD24 != -1 )
          {
            v11 = *(_DWORD *)(this + 56);
            if ( v11 >= dword_ABAD24 && v11 < dword_ABAD24 + 4 )
              return true;
          }
          if ( dword_AA0E28 != -1 )
          {
            v12 = *(_DWORD *)(this + 56);
            if ( v12 >= dword_AA0E28 && v12 < dword_AA0E28 + 16 )
              return true;
          }
          if ( dword_ABAD1C != -1 )
          {
            v13 = *(_DWORD *)(this + 56);
            if ( v13 >= dword_ABAD1C && v13 < dword_ABAD1C + 16 )
              return true;
          }
          if ( dword_ABC2C8 != -1 )
          {
            v14 = *(_DWORD *)(this + 56);
            if ( v14 >= dword_ABC2C8 && v14 < dword_ABC2C8 + 2 )
              return true;
          }
          if ( dword_AA101C == -1 )
            return false;
          v15 = *(_DWORD *)(this + 56);
          if ( v15 < dword_AA101C || v15 >= dword_AA101C + 28 )
            return false;
        }
        else if ( v8 == dword_AA10A0 || v8 == dword_AA10A0 + 3 )
        {
          v9 = *(_BYTE *)(this + 282);
          return v9 != 2 && v9 != 3;
        }
      }
      else if ( v7 == dword_AA1050 || v7 == dword_AA1050 + 3 )
      {
        return *(_BYTE *)(this + 282) >= 2u;
      }
    }
    else if ( v5 == dword_ABB110 || v5 == dword_ABB110 + 3 )
    {
      v6 = *(_BYTE *)(this + 282);
      return v6 != 1 && v6 != 3;
    }
    return true;
  }
  if ( v3 != dword_AA073C && v3 != dword_AA073C + 3 )
    return true;
  v4 = *(_BYTE *)(this + 282);
  return v4 != 0 && v4 != 4;
}
